import { getPool } from '../../../lib/db';
import { syncTransactionsForItem } from '../../../lib/plaidSync';
import { decryptToken } from '../../../lib/crypto';

const pool = getPool();

// Re-syncs every linked Plaid item right now, regardless of whether Plaid's
// webhook ever successfully reached this server. Safe to call anytime:
// it's idempotent (inserts use `on conflict (plaid_transaction_id) do
// nothing`) and doesn't depend on a stored cursor, so it always re-checks
// everything Plaid currently has for each item rather than only "new since
// last time." This is the catch-up path for missed webhook deliveries —
// e.g. the dev server being down when Plaid tried to notify it.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const itemsRes = await pool.query('select item_id, access_token from plaid_items');
    if (itemsRes.rows.length === 0) {
      console.log('[sync-all] no linked accounts to sync');
      return res.status(200).json({ ok: true, added: 0, items: [] });
    }

    const results = [];
    for (const row of itemsRes.rows) {
      try {
        const access_token = decryptToken(row.access_token);
        const added = await syncTransactionsForItem(pool, access_token);
        results.push({ item_id: row.item_id, ok: true, added });
      } catch (itemErr) {
        console.error('[sync-all] item ' + row.item_id + ' failed:', itemErr.response?.data || itemErr.message || itemErr);
        results.push({
          item_id: row.item_id,
          ok: false,
          error: itemErr.response?.data?.error_message || itemErr.message || 'Unknown error',
        });
      }
    }

    const totalAdded = results.reduce((s, r) => s + (r.added || 0), 0);
    console.log('[sync-all] ' + itemsRes.rows.length + ' item(s) checked, ' + totalAdded + ' new transaction(s) total');
    res.status(200).json({ ok: true, added: totalAdded, items: results });
  } catch (err) {
    console.error('[sync-all] fatal error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
}