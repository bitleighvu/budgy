import { getPool } from '../../../../lib/db';

const pool = getPool();

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      await pool.query('update guest_categories set archived = true where id = $1', [id]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to archive category' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { archived, name } = req.body;
      const fields = [];
      const values = [];
      let i = 1;
      if (typeof archived === 'boolean') { fields.push(`archived = $${i++}`); values.push(archived); }
      if (typeof name === 'string' && name.trim()) { fields.push(`name = $${i++}`); values.push(name.trim()); }
      if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
      values.push(id);
      await pool.query(`update guest_categories set ${fields.join(', ')} where id = $${i}`, values);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update category' });
    }
  }

  return res.status(405).end();
}
