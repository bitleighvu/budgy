import { getPool } from '../../lib/db';
import { DEMO_USER_ID } from '../../lib/constants';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const pool = getPool();

  try {
    const { name, budget, month, excludeFromSpending } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const countRes = await pool.query(
      'select count(*)::int as n from categories where user_id = $1',
      [DEMO_USER_ID]
    );
    const colorIdx = countRes.rows[0].n;

    const catRes = await pool.query(
      'insert into categories (user_id, name, color_idx, exclude_from_spending, sort_order) values ($1, $2, $3, $4, $5) returning id',
      [DEMO_USER_ID, name.trim(), colorIdx, !!excludeFromSpending, countRes.rows[0].n]
    );
    const categoryId = catRes.rows[0].id;

    const targetMonth = month || new Date().toISOString().slice(0, 7);
    await pool.query(
      `insert into budgets (category_id, month, amount_cents) values ($1, $2, $3)
       on conflict (category_id, month) do update set amount_cents = excluded.amount_cents`,
      [categoryId, targetMonth, Math.round((budget || 0) * 100)]
    );

    res.status(200).json({ id: categoryId, name: name.trim(), colorIdx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category' });
  }
}