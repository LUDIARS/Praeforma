// 下段タブ「Cc 状態」: Concordia 接続状況 + 選択対象の送出 + 同期 (§6)。
// 未設定なら「未接続」を出し送出ボタンを disabled にする (mock 禁止)。
//
// @spec 6. Cc 接続

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { screenFlowApi, errorText } from '../../lib/screen-flow-api.ts';
import type { Selection } from './types.ts';

interface Props {
  pid: string;
  selection: Selection;
}

export function CcPanel({ pid, selection }: Props): React.ReactElement {
  const qc = useQueryClient();
  const [note, setNote] = React.useState('');
  const statusQ = useQuery({ queryKey: ['cc.status', pid], queryFn: () => screenFlowApi.ccStatus(pid) });
  const sendable = selection.kind === 'layout' || selection.kind === 'transition';

  const sendM = useMutation({
    mutationFn: () =>
      screenFlowApi.ccSend(pid, {
        target_kind: selection.kind as 'layout' | 'transition',
        target_id: selection.id,
        note: note || undefined,
      }),
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['cc.status', pid] });
    },
  });
  const syncM = useMutation({
    mutationFn: () => screenFlowApi.ccSync(pid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc.status', pid] }),
  });

  const configured = statusQ.data?.configured ?? false;

  return (
    <div className="cc-panel">
      <div className="flow-toolbar">
        <span className={`pill ${configured ? 'ok' : 'warn'}`}>{configured ? `Cc 接続中 (template: ${statusQ.data?.template ?? '-'})` : 'Cc 未接続 (PRAEFORMA_CC_URL 未設定)'}</span>
        <button type="button" className="ghost" disabled={!configured || syncM.isPending} onClick={() => syncM.mutate()}>
          状態を同期
        </button>
      </div>
      <div className="cc-send">
        <div>
          送出対象: <strong>{selection.name}</strong> <span className="muted">({selection.kind})</span>
          {!sendable ? <span className="muted"> — 画面か遷移を選ぶと送出できます</span> : null}
        </div>
        <input className="foundation-form" placeholder="委託先への補足 (任意)" value={note} onChange={(e) => setNote(e.target.value)} disabled={!configured || !sendable} />
        <button type="button" className="primary" disabled={!configured || !sendable || sendM.isPending} onClick={() => sendM.mutate()}>
          Cc へ送る
        </button>
        {sendM.isError ? (
          <div className="error">
            送出失敗: {errorText(sendM.error)}
            {errorText(sendM.error) === 'anatomia_domain_required' ? ' — 対象画面のドメインを Anatomia と突合してください' : ''}
          </div>
        ) : null}
        {sendM.data ? <div className="muted">run {sendM.data.link.ccId} を登録しました{sendM.data.prompt_file_path ? ` (prompt: ${sendM.data.prompt_file_path})` : ''}</div> : null}
      </div>
      <table className="cc-links">
        <thead>
          <tr>
            <th>対象</th>
            <th>run</th>
            <th>状態</th>
            <th>同期</th>
          </tr>
        </thead>
        <tbody>
          {(statusQ.data?.links ?? []).map((l) => (
            <tr key={l.id}>
              <td>
                {l.targetKind}:{l.targetId}
              </td>
              <td>{l.ccId}</td>
              <td>
                <span className={`pill ${l.status}`}>{l.status}</span>
              </td>
              <td className="muted">{l.lastSyncedAt ? new Date(l.lastSyncedAt).toLocaleString() : '-'}</td>
            </tr>
          ))}
          {statusQ.data && statusQ.data.links.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                まだ送出していません
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
