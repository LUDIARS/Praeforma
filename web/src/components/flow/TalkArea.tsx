// 右ペイン: LLM トークエリア。 選択中の対象に紐づく会話 1 本を表示し、 送信中はロックする (§5)。
//
// @spec 5. LLM トークエリア

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { screenFlowApi, errorText, type ConversationMessage } from '../../lib/screen-flow-api.ts';
import { ProposalCard } from './ProposalCard.tsx';
import type { Selection } from './types.ts';

interface Props {
  pid: string;
  selection: Selection;
  screenName: (id: string) => string;
  widgetName: (placementId: string | null) => string;
  /** 提案を反映したあと、 構造 (layouts / transitions / specs) を再取得するための hook。 */
  onApplied: () => void;
}

export function TalkArea({ pid, selection, screenName, widgetName, onApplied }: Props): React.ReactElement {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState('');
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const targetId = selection.kind === 'project' ? pid : selection.id;
  const key = ['conversation', pid, selection.kind, targetId];

  const convQ = useQuery({
    queryKey: key,
    queryFn: () => screenFlowApi.getConversation(pid, selection.kind, targetId),
  });

  const sendM = useMutation({
    mutationFn: async (message: string) => {
      const conv = convQ.data?.conversation;
      if (conv) return screenFlowApi.sendMessage(pid, conv.id, message);
      return screenFlowApi.startConversation(pid, { target_kind: selection.kind, target_id: targetId, message });
    },
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const applyM = useMutation({
    mutationFn: ({ mid, index }: { mid: string; index: number }) =>
      screenFlowApi.applyProposals(pid, convQ.data!.conversation!.id, mid, [index]),
    // 反映済みフラグはサーバが proposals[].applied に持つので、 再取得すれば復元される。
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      onApplied();
    },
  });

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [convQ.data?.messages.length, sendM.isPending]);

  const messages: ConversationMessage[] = convQ.data?.messages ?? [];
  const busy = sendM.isPending || applyM.isPending;

  return (
    <div className="talk-area">
      <div className="talk-head">
        <strong>💬 {selection.name}</strong>
        <span className="muted">{selection.kind}</span>
      </div>
      <div className="talk-list" ref={listRef}>
        {convQ.isLoading ? <div className="muted">loading…</div> : null}
        {messages.length === 0 && !convQ.isLoading ? (
          <div className="muted">この対象についてまだ会話がありません。 「この画面の要件を考えて」「ボタンを足して」などから始めてください。</div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={`talk-msg ${m.role}`}>
            <div className="talk-msg-body">{m.content}</div>
            {m.role === 'assistant' && m.proposals.length > 0 ? (
              <div className="talk-proposals">
                {m.proposals.map((p, i) => (
                  <ProposalCard
                    key={i}
                    proposal={p}
                    index={i}
                    applied={p.applied === true}
                    busy={busy}
                    screenName={screenName}
                    widgetName={widgetName}
                    onApply={(index) => applyM.mutate({ mid: m.id, index })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {sendM.isPending ? <div className="talk-msg assistant muted">考え中… (claude -p)</div> : null}
        {sendM.isError ? <div className="error">送信失敗: {errorText(sendM.error)}</div> : null}
        {applyM.isError ? <div className="error">反映失敗: {errorText(applyM.error)}</div> : null}
        {applyM.data?.failed ? <div className="error">反映失敗 (#{applyM.data.failed.index}): {applyM.data.failed.error}</div> : null}
      </div>
      <form
        className="talk-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || busy) return;
          sendM.mutate(draft.trim());
        }}
      >
        <textarea
          className="foundation-form"
          rows={3}
          placeholder="仕様を会話で育てる (Ctrl+Enter で送信)"
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (draft.trim() && !busy) sendM.mutate(draft.trim());
            }
          }}
        />
        <button type="submit" className="primary" disabled={busy || !draft.trim()}>
          送信
        </button>
      </form>
    </div>
  );
}
