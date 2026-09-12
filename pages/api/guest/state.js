import { getGuestAppState } from '../../../lib/getGuestAppState';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const data = await getGuestAppState();
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load guest state' });
  }
}