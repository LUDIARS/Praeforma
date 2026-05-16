import React from 'react';
import { useNavigate } from 'react-router';
import { setToken } from '../lib/api.ts';

export function LoginPage(): React.ReactElement {
  const [token, setTokenInput] = React.useState('');
  const [baseUrlNote] = React.useState(
    'Cernere の Web UI でログインして発行された PASETO V4 token をここに貼り付けてください。',
  );
  const nav = useNavigate();

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!token.trim()) return;
    setToken(token.trim());
    nav('/', { replace: true });
  }

  return (
    <main className="content" style={{ maxWidth: 480 }}>
      <div className="panel foundation-form">
        <h2>Praeforma — サインイン</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>{baseUrlNote}</p>
        <form onSubmit={onSubmit}>
          <label className="simple-field">
            <span>PASETO Token</span>
            <textarea
              value={token}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="v4.public...."
              rows={6}
              required
            />
          </label>
          <div className="simple-actions">
            <button type="submit" className="primary" disabled={!token.trim()}>
              Sign in
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
