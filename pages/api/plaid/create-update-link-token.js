import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { getPool } from '../../../lib/db';
import { decryptToken } from '../../../lib/crypto';

const client = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

const pool = getPool();

// Update mode: pass the *existing* item's access_token when creating the
// link_token (instead of just user info, and with no `products` array).
// Plaid runs an abbreviated re-auth flow — often just the one new OTP or
// updated password, not a full re-onboarding — and the original
// access_token keeps working afterward. No exchange step needed once
// Link's onSuccess fires; a normal sync afterward is enough to confirm
// the item is healthy again.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { id } = req.body; // plaid_items.id (our local uuid)
    if (!id) return res.status(400).json({ error: 'id is required' });

    const itemRes = await pool.query('select access_token from plaid_items where id = $1', [id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Connection not found' });

    const access_token = decryptToken(itemRes.rows[0].access_token);

    const response = await client.linkTokenCreate({
      user: { client_user_id: 'demo-user' },
      client_name: 'Budgy',
      access_token,
      country_codes: ['US'],
      language: 'en',
      webhook: `${process.env.APP_URL}/api/plaid/webhook`,
    });

    res.status(200).json({ link_token: response.data.link_token });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Failed to create update-mode link token' });
  }
}