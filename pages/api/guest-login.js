// Entirely separate from the real login: a different password
// (GUEST_PASSWORD, not AUTH_PASSWORD) and a different cookie
// (budgy_guest_session, signed with GUEST_SESSION_TOKEN) — a guest
// session and your own real session can't be confused with each other or
// forged from one into the other.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  if (!process.env.GUEST_PASSWORD) {
    return res.status(500).json({ error: 'Guest access is not configured' });
  }
  if (password === process.env.GUEST_PASSWORD) {
    const maxAge = 60 * 60 * 24 * 7; // 7 days — shorter-lived than the real session on purpose
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `budgy_guest_session=${process.env.GUEST_SESSION_TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Incorrect password' });
}
