import { getPool } from '../../../lib/db';

const pool = getPool();

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    try {
      const { categoryId, description } = req.body;
      await pool.query(
        'update transactions set category_id = $1, description = $2 where id = $3',
        [categoryId || null, description || null, id]
      );
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update transaction' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await pool.query('delete from transactions where id = $1', [id]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to delete transaction' });
    }
  }

  return res.status(405).end();
}