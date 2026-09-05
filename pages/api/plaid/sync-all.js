import { getPool } from '../../../lib/db';
import { syncTransactionsForItem } from '../../../lib/plaidSync';
import { decryptToken } from '../../../lib/crypto';

const pool = getPool();

// Incrementally re-syncs every linked Plaid item using each one's stored
// cursor — fast, since it only asks Plaid for what's changed since last
// time rather than the full history. Called on app load and from the
// manual sync trigger. This is NOT the safety net for a missed webhook
// delivery on its own anymore (a cursor-based sync only knows about
// changes reported after the cursor it's given, so it can't retroactively
// notice something it was never told about) — that job now belongs to the
// daily full-reconciliation cron (see reconcile.js).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const itemsRes = await pool.query('select item_id, access_token, cursor from plaid_items');
    if (itemsRes.rows.length === 0) {
      console.log('[sync-all] no linked accounts to sync');
      return res.status(200).json({ ok: true, added: 0, items: [] });
    }

    const results = [];
    for (const row of itemsRes.rows) {
      try {
        const access_token = decryptToken(row.access_token);
        const result = await syncTransactionsForItem(pool, access_token, row.cursor);
        await pool.query('update plaid_items set cursor = $1 where item_id = $2', [result.cursor, row.item_id]);
        results.push({ item_id: row.item_id, ok: true, ...result });
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