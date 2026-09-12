import { getPool } from '../../../../lib/db';

const pool = getPool();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order (array) is required' });
    for (let i = 0; i < order.length; i++) {
      await pool.query('update guest_categories set sort_order = $1 where id = $2', [i, order[i]]);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder categories' });
  }
}
