import { getPool } from '../../../lib/db';
import { DEMO_USER_ID } from '../../../lib/constants';

const pool = getPool();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'endpoint and keys.p256dh/keys.auth are required' });
    }
    await pool.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
       values ($1, $2, $3, $4)
       on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`,
      [DEMO_USER_ID, endpoint, keys.p256dh, keys.auth]
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
}