import { getPool } from '../../../lib/db';

// Updates category and/or description on an existing transaction — either
// field can be sent alone (e.g. just recategorizing) or together.
export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();
  const pool = getPool();

  try {
    const { id } = req.query;
    const { categoryId, description } = req.body;

    const fields = [];
    const values = [];
    let i = 1;
    if (categoryId !== undefined) { fields.push(`category_id = $${i++}`); values.push(categoryId); }
    if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description || null); }

    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    values.push(id);
    await pool.query(`update transactions set ${fields.join(', ')} where id = $${i}`, values);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
}
