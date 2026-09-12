import { getPool } from '../../../../lib/db';

const pool = getPool();

// Each entry: { categoryId, month ('YYYY-MM'), spent (number), budget (number, optional) }
// Category resolution (name -> id) happens client-side, where the loaded
// category list already lives — this route just trusts the ids it's given.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries (array) is required' });
    }

    let inserted = 0;
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e.categoryId || !e.month || typeof e.spent !== 'number' || e.spent < 0) {
        errors.push({ row: i + 1, error: 'Missing or invalid categoryId/month/spent' });
        continue;
      }
      try {
        await pool.query(
          `insert into guest_transactions (category_id, merchant, amount_cents, date, description)
           values ($1, $2, $3, $4, $5)`,
          [e.categoryId, 'Historical total', Math.round(e.spent * 100), e.month + '-01', 'Backfilled historical total']
        );
        if (typeof e.budget === 'number' && e.budget >= 0) {
          await pool.query(
            `insert into guest_budgets (category_id, month, amount_cents) values ($1, $2, $3)
             on conflict (category_id, month) do update set amount_cents = excluded.amount_cents`,
            [e.categoryId, e.month, Math.round(e.budget * 100)]
          );
        }
        inserted++;
      } catch (rowErr) {
        console.error('[guest bulk-backfill] row ' + (i + 1) + ' failed:', rowErr);
        errors.push({ row: i + 1, error: 'Database error' });
      }
    }

    res.status(200).json({ ok: true, inserted, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk import failed' });
  }
}