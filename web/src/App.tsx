import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, clearToken } from './lib/api.ts';

export function App(): React.ReactElement {
  const navigate = useNavigate();
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => api.me() });

  function onSignOut(): void {
    clearToken();
    navigate('/login');
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Link to="/" style={{ color: 'inherit' }}>Praeforma</Link>
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-info">
          {meQ.data ? (
            <>
              {meQ.data.displayName ?? meQ.data.userId}
              <span className={`role-badge ${meQ.data.role}`}>{meQ.data.role}</span>
            </>
          ) : (
            'loading…'
          )}
        </div>
        <button className="ghost" type="button" onClick={onSignOut}>Sign out</button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </>
  );
}
