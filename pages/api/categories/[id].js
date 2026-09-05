import { getPool } from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  const pool = getPool();
  try {
    const { id } = req.query;
    await pool.query('delete from categories where id = $1', [id]);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
}