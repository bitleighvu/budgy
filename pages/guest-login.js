import { useState } from 'react';
import Head from 'next/head';

export default function GuestLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    fetch('/api/guest-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((r) => {
        if (r.ok) {
          window.location.href = '/guest';
        } else {
          return r.json().then((body) => { throw new Error(body.error || 'Incorrect password'); });
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  return (
    <>
      <Head>
        <title>Budgy - Guest Demo</title>
      </Head>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-brand">Budgy</div>
          <p style={{fontSize:'12px', color:'var(--ink-soft)', textAlign:'center', margin:'-14px 0 20px'}}>Guest demo — fake data only</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">Guest Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="fab" disabled={loading}>
              {loading ? 'Entering…' : 'Enter Demo'}
            </button>
          </form>
          <a href="/login" className="guest-login-link">← Back to Sign In</a>
        </div>
      </div>
    </>
  );
}