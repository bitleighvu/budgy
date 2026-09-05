import { getPool } from '../../../lib/db';

const pool = getPool();

// Takes the full list of category ids in the order they should display,
// and writes each one's position as its sort_order.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order (array of category ids) is required' });
    }
    for (let i = 0; i < order.length; i++) {
      await pool.query('update categories set sort_order = $1 where id = $2', [i, order[i]]);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
}