/** Keep existing data-design links pointing to the shared project tabs. */
import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router';

export function DataDesignPage(): React.ReactElement {
  const { pid } = useParams();
  const location = useLocation();
  if (!pid) return <p role="alert">プロジェクトが指定されていません。</p>;
  const search = new URLSearchParams(location.search);
  search.set('tab', 'data-design');
  return <Navigate replace to={{ pathname: `/projects/${pid}`, search: `?${search}`, hash: location.hash }} />;
}
