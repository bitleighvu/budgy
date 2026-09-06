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

// Dev-only: forces a real Sandbox Item into ITEM_LOGIN_REQUIRED so you can
// test the reauth banner and update-mode Link flow end to end, without
// waiting for a real bank to actually require re-authentication. Plaid
// also fires a genuine ITEM_LOGIN_REQUIRED webhook to your configured
// webhook URL as part of this call, so it exercises the same code path a
// real occurrence would.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (process.env.PLAID_ENV !== 'sandbox') {
    return res.status(400).json({ error: 'Only available when PLAID_ENV=sandbox' });
  }

  try {
    const { id } = req.body; // plaid_items.id (our local uuid); defaults to most recently linked
    const itemRes = id
      ? await pool.query('select access_token from plaid_items where id = $1', [id])
      : await pool.query('select access_token from plaid_items order by created_at desc limit 1');

    if (itemRes.rows.length === 0) {
      return res.status(400).json({ error: 'No linked bank account found — connect one first.' });
    }

    const access_token = decryptToken(itemRes.rows[0].access_token);
    await client.sandboxItemResetLogin({ access_token });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Failed to reset login' });
  }
}