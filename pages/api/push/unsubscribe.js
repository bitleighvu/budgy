import { getPool } from '../../../lib/db';

const pool = getPool();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await pool.query('delete from push_subscriptions where endpoint = $1', [endpoint]);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
}