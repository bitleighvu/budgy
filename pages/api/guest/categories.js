import { getPool } from '../../../lib/db';

const pool = getPool();
const PALETTE_SIZE = 9;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { name, excludeFromSpending } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const usedRes = await pool.query('select color_idx from guest_categories');
    const used = new Set(usedRes.rows.map((r) => r.color_idx));
    let colorIdx = usedRes.rows.length % PALETTE_SIZE;
    for (let i = 0; i < PALETTE_SIZE; i++) {
      if (!used.has(i)) { colorIdx = i; break; }
    }

    const result = await pool.query(
      `insert into guest_categories (name, color_idx, exclude_from_spending, sort_order)
       values ($1, $2, $3, $4) returning id`,
      [name.trim(), colorIdx, !!excludeFromSpending, usedRes.rows.length]
    );
    res.status(200).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category' });
  }
}
