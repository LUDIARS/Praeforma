import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ProjectListPage } from './pages/ProjectListPage.tsx';
import { ProjectShowPage } from './pages/ProjectShowPage.tsx';
import { LayoutEditorPage } from './pages/LayoutEditorPage.tsx';
import { getToken } from './lib/api.ts';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function RequireAuth({ children }: { children: React.ReactNode }): React.ReactElement {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

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
            <Route path="projects/:pid/layouts/:lid" element={<LayoutEditorPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
