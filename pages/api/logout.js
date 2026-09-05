export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  // Must match every attribute login.js used when setting the cookie
  // (Path, SameSite, and critically Secure) — a mismatch, even just the
  // Secure flag, is a well-known way for browsers to treat this as a
  // different cookie and silently ignore the clear. Expires is included
  // alongside Max-Age=0 for older browsers that only honor one of the two.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `budgy_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`
  );
  res.status(200).json({ ok: true });
}