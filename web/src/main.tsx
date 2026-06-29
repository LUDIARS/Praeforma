import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ProjectListPage } from './pages/ProjectListPage.tsx';
import { ProjectShowPage } from './pages/ProjectShowPage.tsx';
import { LayoutEditorPage } from './pages/LayoutEditorPage.tsx';
import { StudioPage } from './pages/StudioPage.tsx';
import { getToken, setToken } from './lib/api.ts';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function RequireAuth({ children }: { children: React.ReactNode }): React.ReactElement {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ローカル「仕様書レビュー」モードでは Cernere ログインを省略し、 固定トークンを使う。
// サーバの /api/health が localMode を返したら token を自動セットして RequireAuth を通す。
async function ensureLocalToken(): Promise<void> {
  if (getToken()) return;
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return;
    const h = (await res.json()) as { localMode?: boolean };
    if (h.localMode) setToken('local');
  } catch {
    /* オフライン等は通常ログインへ */
  }
}

void ensureLocalToken().then(() => {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><App /></RequireAuth>}>
              <Route index element={<ProjectListPage />} />
              <Route path="projects/:pid" element={<ProjectShowPage />} />
              <Route path="projects/:pid/studio" element={<StudioPage />} />
              <Route path="projects/:pid/layouts/:lid" element={<LayoutEditorPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
