import { getPool } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const pool = getPool();

  try {
    const { merchant, amount, date, description } = req.body;
    if (!merchant || !amount || !date) {
      return res.status(400).json({ error: 'merchant, amount, and date are required' });
    }
    // category_id starts null — it lands straight in the "to categorize" queue,
    // same as a transaction that arrived through the Plaid webhook.
    const result = await pool.query(
      `insert into transactions (category_id, merchant, amount_cents, date, description)
       values (null, $1, $2, $3, $4) returning id`,
      [merchant, Math.round(amount * 100), date, description || null]
    );
    res.status(200).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
}
