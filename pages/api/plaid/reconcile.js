import { getPool } from '../../../lib/db';
import { syncTransactionsForItem } from '../../../lib/plaidSync';
import { decryptToken } from '../../../lib/crypto';

const pool = getPool();

// Called once a day by Vercel Cron (see vercel.json). Ignores each item's
// stored cursor and does a full resync from scratch, the same way the app
// used to work before cursors existed — this is the safety net an
// incremental cursor-based sync gives up: if a webhook delivery ever
// failed silently, a cursor-only sync has no way to notice, since it only
// knows about changes Plaid explicitly reports after the cursor it's
// given. A periodic full check catches that regardless. After each
// item's full resync, its cursor is reset to the fresh position Plaid
// returns, so the next incremental sync continues from a known-good
// baseline.
export default async function handler(req, res) {
  // Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on
  // cron-triggered requests when CRON_SECRET is set as an env var — this
  // is what stops anyone who finds this URL from triggering it manually.
  const auth = req.headers.authorization;
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const itemsRes = await pool.query('select item_id, access_token from plaid_items');
    const results = [];
    for (const row of itemsRes.rows) {
      try {
        const access_token = decryptToken(row.access_token);
        // No stored cursor passed — forces a full resync from scratch.
        const result = await syncTransactionsForItem(pool, access_token, undefined);
        await pool.query('update plaid_items set cursor = $1 where item_id = $2', [result.cursor, row.item_id]);
        results.push({ item_id: row.item_id, ok: true, ...result });
      } catch (itemErr) {
        console.error('[reconcile] item ' + row.item_id + ' failed:', itemErr.response?.data || itemErr.message || itemErr);
        results.push({
          item_id: row.item_id,
          ok: false,
          error: itemErr.response?.data?.error_message || itemErr.message || 'Unknown error',
        });
      }
    }
    console.log('[reconcile] ' + itemsRes.rows.length + ' item(s) fully reconciled');
    res.status(200).json({ ok: true, items: results });
  } catch (err) {
    console.error('[reconcile] fatal error:', err);
    res.status(500).json({ error: 'Reconciliation failed' });
  }
}