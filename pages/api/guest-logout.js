export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `budgy_guest_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`
  );
  res.status(200).json({ ok: true });
}
