import webpush from 'web-push';
import { getPool } from './db';

webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_CONTACT_EMAIL || 'admin@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Sends to every subscribed browser/device (usually just your phone and
// maybe a laptop). A subscription that's expired or been revoked returns
// a 404/410 from the push service — that's the signal to clean it up
// rather than an error worth logging loudly.
export async function sendPushToAll(payload) {
  const pool = getPool();
  const subsRes = await pool.query('select id, endpoint, p256dh, auth from push_subscriptions');

  for (const sub of subsRes.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('delete from push_subscriptions where id = $1', [sub.id]);
      } else {
        console.error('[push] failed to send to one subscription:', err.message);
      }
    }
  }
}