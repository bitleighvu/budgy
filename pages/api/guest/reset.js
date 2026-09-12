import { getPool } from '../../../lib/db';
import { resetGuestData } from '../../../lib/guestSeed';

const pool = getPool();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    await resetGuestData(pool);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset guest data' });
  }
}
