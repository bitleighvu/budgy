// Checks credentials against AUTH_USER/AUTH_PASSWORD, and on success sets a
// cookie carrying SESSION_TOKEN — a long random secret that only this
// server knows, generated once with `openssl rand -hex 32`. middleware.js
// checks incoming requests for a cookie matching that exact value. There's
// no per-user session store since this is a single-user app: the cookie
// either matches the one known-good secret or it doesn't.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body || {};
  if (username === process.env.AUTH_USER && password === process.env.AUTH_PASSWORD) {
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `budgy_session=${process.env.SESSION_TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Invalid username or password' });
}