import { getPool } from '../../../lib/db';

const pool = getPool();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { categoryId, month, amount } = req.body;
    if (!categoryId || !month || typeof amount !== 'number') {
      return res.status(400).json({ error: 'categoryId, month, and amount are required' });
    }
    await pool.query(
      `insert into guest_budgets (category_id, month, amount_cents) values ($1, $2, $3)
       on conflict (category_id, month) do update set amount_cents = excluded.amount_cents`,
      [categoryId, month, Math.round(amount * 100)]
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save budget' });
  }
}
