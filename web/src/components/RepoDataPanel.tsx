// 設計データの保存ブランチ (spec/feature/repo-data-branch.md) の操作。
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { req, type ApiError } from '../lib/api.ts';

interface RepoDataStatus { repoDir: string; branch: string; head: string | null }
interface PublishResult { commit: string; changed: boolean; files: number }
interface PushResult { commit: string }
interface ImportResult { imported: number; existing: number; conflicts: number }

const SHORT_COMMIT_LENGTH = 7;

function failureMessage(error: unknown): string {
  const status = (error as ApiError).status;
  if (status === 403) return 'この操作を行う権限がありません。';
  const code = ((error as ApiError).body as { error?: string } | null)?.error;
  if (code === 'data_branch_moved') return '他の更新が先に入りました。もう一度保存してください。';
  if (code === 'data_branch_missing') return 'このリポジトリにはまだ保存ブランチがありません。';
  if (code === 'data_branch_push_failed') return 'GitHub への送信に失敗しました。リポジトリの接続先と権限を確認してください。';
  return '操作に失敗しました。';
}

export function RepoDataPanel({ pid }: { pid: string }): React.ReactElement | null {
  const base = `/api/projects/${pid}/repo-data`;
  const queryKey = ['repo-data', pid];
  const client = useQueryClient();
  const status = useQuery({ queryKey, queryFn: () => req<RepoDataStatus>(base), retry: false });
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const run = async (action: () => Promise<string>): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
      await client.invalidateQueries({ queryKey });
    } catch (error) {
      setMessage(failureMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const publish = async (): Promise<string> => {
    const result = await req<PublishResult>(`${base}/publish`, { method: 'POST' });
    return result.changed ? `${result.files} 件のファイルを保存しました。` : '変更はありませんでした。';
  };
  const push = async (): Promise<string> => {
    const result = await req<PushResult>(`${base}/push`, { method: 'POST' });
    return `GitHub へ送信しました (${result.commit.slice(0, SHORT_COMMIT_LENGTH)})。`;
  };
  const importBranch = async (): Promise<string> => {
    const result = await req<ImportResult>(`${base}/import`, { method: 'POST' });
    const conflict = result.conflicts > 0 ? ` 内容が食い違う ${result.conflicts} 件は変更していません。` : '';
    return `フラグメントを ${result.imported} 件取り込みました (既存 ${result.existing} 件)。${conflict}`;
  };

  if (status.isPending) return null;
  if (!status.data) return <section className="panel" role="alert">保存先のリポジトリが見つかりません。</section>;
  return <section className="panel">
    <h3>設計データの保存先</h3>
    <p>{status.data.repoDir} の {status.data.branch} ブランチ
      {status.data.head ? ` (${status.data.head.slice(0, SHORT_COMMIT_LENGTH)})` : ' (未作成)'}</p>
    <button type="button" disabled={busy} onClick={() => { void run(publish); }}>ブランチへ保存</button>{' '}
    <button type="button" disabled={busy || !status.data.head} onClick={() => { void run(push); }}>GitHub へ送信</button>{' '}
    <button type="button" disabled={busy || !status.data.head} onClick={() => { void run(importBranch); }}>フラグメントを取り込む</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
