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
import { ScreenFlowPage } from './pages/ScreenFlowPage.tsx';
import { UxCoreDesignPage } from './pages/UxCoreDesignPage.tsx';
import { getToken, setToken } from './lib/api.ts';

const queryClient = new QueryClient({
  // UI調整期間は再訪時に必ず再取得し、未使用のquery結果を保持しない。
  defaultOptions: { queries: { staleTime: 0, gcTime: 0, retry: 1 } },
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
    const res = await fetch('/api/health', { cache: 'no-store' });
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
              <Route path="projects/:pid/flow" element={<ScreenFlowPage />} />
              <Route path="projects/:pid/ux-design" element={<UxCoreDesignPage />} />
              <Route path="projects/:pid/layouts/:lid" element={<LayoutEditorPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
