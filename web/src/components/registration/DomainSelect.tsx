import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.ts';

export function DomainSelect({ pid, value, onChange }: {
  pid: string; value: string; onChange: (value: string) => void;
}): React.ReactElement {
  const query = useQuery({ queryKey: ['domains', pid], queryFn: () => api.listDomains(pid) });
  return <div>
    <label className="simple-field"><span>ドメイン（必須）</span>
      <select required value={value} onChange={(event) => onChange(event.target.value)} disabled={!query.isSuccess}>
        <option value="">ドメインを選択</option>
        {query.data?.items.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
      </select>
    </label>
    {query.isPending && <p role="status">ドメインを取得中…</p>}
    {query.isError && <p role="alert">ドメインを取得できませんでした。
      <button type="button" className="ghost" onClick={() => { void query.refetch(); }}>再取得</button>
    </p>}
    {query.isSuccess && query.data.items.length === 0 && <p>
      先に<Link to={`/projects/${pid}?tab=domains`}>ドメインを登録</Link>してください。
    </p>}
  </div>;
}
