// 各ブランチの .praeforma/ にある設計データの写しと、Pf の最新との違い (spec/feature/branch-snapshot.md)。読み取り専用。
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { req } from '../lib/api.ts';

type FileStatus = 'same' | 'changed' | 'missing_in_branch' | 'only_in_branch';
interface BranchSnapshot {
  name: string; commit: string; updatedAt: string;
  state: 'none' | 'invalid' | 'same' | 'differs';
  branchSpecVersion: string | null;
  files: Array<{ path: string; status: FileStatus }>;
}

const STATE_LABELS: Record<BranchSnapshot['state'], string> = {
  none: '写しなし', invalid: '写しが読めない', same: '最新と一致', differs: '最新と違う',
};
const FILE_LABELS: Record<FileStatus, string> = {
  same: '一致', changed: '内容が違う', missing_in_branch: 'ブランチに無い', only_in_branch: 'ブランチにだけある',
};

export function BranchSnapshotPanel({ pid }: { pid: string }): React.ReactElement {
  const query = useQuery({
    queryKey: ['branch-snapshot', pid],
    queryFn: () => req<{ repoDir: string; items: BranchSnapshot[] }>(`/api/projects/${encodeURIComponent(pid)}/branch-snapshot/branches`),
    retry: false,
  });
  const code = ((query.error as { body?: { error?: string } } | null)?.body)?.error;
  return <section className="panel" aria-labelledby="branch-snapshot-title">
    <h3 id="branch-snapshot-title">ブランチの設計データ</h3>
    <p className="meta">各ブランチの <code>.praeforma/</code> にある写しと、Pf の最新を比べます。
      写しは作業中のブランチで <code>server/scripts/pf-snapshot.ts</code> を実行して書き出し、コードと一緒に commit します。</p>
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">{code === 'repo_dir_not_found'
      ? 'このプロジェクトのリポジトリが見つかりません。保存先のフォルダ名を設定してください。'
      : 'ブランチの写しを取得できませんでした。'}</p>}
    {query.isSuccess && <>
      <p className="meta">リポジトリ: {query.data.repoDir}</p>
      {query.data.items.length === 0 && <p>ブランチがありません。</p>}
      <ul className="item-list">{query.data.items.map((branch) => <li key={branch.name} className="item-row">
        <details>
          <summary>
            <strong>{branch.name}</strong> <span className="role-badge">{STATE_LABELS[branch.state]}</span>
            {branch.branchSpecVersion && <span className="meta"> 仕様 v{branch.branchSpecVersion}</span>}
            <span className="meta"> {branch.commit.slice(0, 8)}</span>
          </summary>
          {branch.files.length === 0 ? <p className="meta">比べるファイルはありません。</p>
            : <ul>{branch.files.map((file) => <li key={file.path}><code>{file.path}</code> — {FILE_LABELS[file.status]}</li>)}</ul>}
        </details>
      </li>)}</ul>
    </>}
  </section>;
}
