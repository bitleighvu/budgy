import { getPool } from '../../../lib/db';

const pool = getPool();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { merchant, amount, date, description, categoryId } = req.body;
    if (!merchant || !amount || !date) {
      return res.status(400).json({ error: 'merchant, amount, and date are required' });
    }
    const result = await pool.query(
      `insert into guest_transactions (category_id, merchant, amount_cents, date, description)
       values ($1, $2, $3, $4, $5) returning id`,
      [categoryId || null, merchant, Math.round(amount * 100), date, description || null]
    );
    res.status(200).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
}