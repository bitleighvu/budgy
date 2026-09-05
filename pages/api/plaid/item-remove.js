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

// Properly disconnects a bank connection: tells Plaid to release the Item
// (so it stops counting against your 10-connection limit) *before*
// deleting it locally. A plain `delete from plaid_items` only does the
// second half — Plaid keeps counting the Item as active since it was
// never told otherwise, which is what caused the local/Plaid count
// mismatch this route exists to prevent going forward.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { id } = req.body; // plaid_items.id (our local uuid), not Plaid's item_id
    if (!id) return res.status(400).json({ error: 'id is required' });

    const itemRes = await pool.query('select access_token from plaid_items where id = $1', [id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Connection not found' });

    const access_token = decryptToken(itemRes.rows[0].access_token);

    try {
      await client.itemRemove({ access_token });
    } catch (plaidErr) {
      // If Plaid's already lost track of this Item (e.g. it was previously
      // orphaned some other way), don't let that block cleaning up our
      // own side — log it and continue.
      console.error('[item-remove] Plaid removal failed, deleting locally anyway:', plaidErr.response?.data || plaidErr.message);
    }

    // Cascades to accounts; transactions.account_id is set to null on
    // delete, so transaction history from this connection is preserved.
    await pool.query('delete from plaid_items where id = $1', [id]);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
}