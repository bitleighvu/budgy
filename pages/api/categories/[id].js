import { getPool } from '../../../lib/db';

const pool = getPool();

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    // "Deleting" archives rather than hard-deletes: it stops appearing on
    // the dashboard, in the categorize screen's category chips, and in
    // Manage Categories — but every transaction already tagged with it
    // keeps that tag, so past months' categorization and Analytics
    // history stay intact. A true delete would set transactions.category_id
    // to null for every transaction ever filed under it (via the
    // on-delete-set-null foreign key), dumping potentially months of
    // history back into the "to categorize" queue.
    try {
      await pool.query('update categories set archived = true where id = $1', [id]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to archive category' });
    }
  }

  if (req.method === 'PATCH') {
    // Accepts archived (boolean) and/or name (string) — either or both,
    // whatever the caller wants to change.
    try {
      const { archived, name } = req.body;
      const fields = [];
      const values = [];
      let i = 1;
      if (typeof archived === 'boolean') { fields.push(`archived = $${i++}`); values.push(archived); }
      if (typeof name === 'string' && name.trim()) { fields.push(`name = $${i++}`); values.push(name.trim()); }

      if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

      values.push(id);
      await pool.query(`update categories set ${fields.join(', ')} where id = $${i}`, values);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update category' });
    }
  }

  return res.status(405).end();
}