import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { req, type ApiError } from '../../lib/api.ts';
import { CHAT_IDLE_MS, type ChatView } from '../../../../shared/llm-chat.ts';
import '../../styles/llm-chat.css';

function errorText(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError?.status === 403) return 'AI相談にはオーナーまたは企画者の権限が必要です。';
  if (apiError?.status === 503) return 'Ccへの接続設定がありません。';
  if (apiError?.status === 409) return '会話の処理中、または状態が変わりました。再接続して確認してください。';
  return 'Ccと通信できませんでした。送信は自動で繰り返しません。再接続して会話を確認してください。';
}

export function LlmChatWindow({ pid, onClose }: { pid: string; onClose: () => void }): React.ReactElement {
  const base = `/api/projects/${pid}/llm-chat`;
  const [text, setText] = React.useState('');
  const [disconnected, setDisconnected] = React.useState(false);
  const [connectedAt, setConnectedAt] = React.useState(Date.now);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const scroll = React.useRef<HTMLDivElement>(null);
  const query = useQuery({ queryKey: ['llm-chat', pid], queryFn: ({ signal }) => req<ChatView>(base, { signal }),
    enabled: !disconnected, refetchInterval: disconnected ? false : 3000, retry: false });
  const mutation = useMutation({
    mutationFn: async ({ action, message }: { action: 'messages' | 'resume' | 'clear'; message?: string }) => {
      await req(`${base}/${action}`, { method: 'POST', body: JSON.stringify(action === 'messages' ? { text: message } : {}) });
      return action;
    },
    onSuccess: async action => {
      if (action === 'messages' || action === 'clear') setText('');
      setConfirmClear(false); setDisconnected(false); setConnectedAt(Date.now());
      await query.refetch();
    },
    onError: async () => { await query.refetch(); setDisconnected(true); },
  });
  React.useEffect(() => {
    if (query.isError) setDisconnected(true);
  }, [query.isError]);
  React.useEffect(() => {
    const tick = (): void => {
      if (Date.now() - Math.max(connectedAt, query.data?.lastActivity ?? 0) >= CHAT_IDLE_MS) setDisconnected(true);
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [connectedAt, query.data?.lastActivity]);
  React.useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [query.data?.messages.length]);
  const state = query.data?.state;
  const canSend = !disconnected && (state === 'empty' || state === 'ready') && !mutation.isPending;
  return <aside id="pf-llm-window" className="pf-llm-window" role="dialog" aria-label="AI相談" aria-modal="false"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header className="pf-llm-title"><strong>AI相談</strong>
      <button type="button" className="ghost" onClick={onClose} aria-label="AI相談を畳む">畳む</button>
    </header>
    <div className="pf-llm-toolbar">
      <span>{disconnected ? '切断中（会話は保存されています）' : state === 'starting' ? 'Ccセッション起動中…' : state === 'ended' ? '再開できます' : '仕様・設計を相談'}</span>
      <button type="button" className="ghost" disabled={mutation.isPending || !query.data || state === 'empty'} onClick={() => setConfirmClear(true)}>Clear</button>
    </div>
    {confirmClear && <div className="pf-llm-notice"><p>この会話を終了して、新しい会話にしますか？</p>
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: 'clear' })}>会話をクリア</button>
      <button type="button" onClick={() => setConfirmClear(false)}>戻る</button>
    </div>}
    {(query.isError || mutation.isError) && <p className="pf-llm-notice" role="alert">{errorText(mutation.error ?? query.error)}</p>}
    {state === 'uncertain' && <p className="pf-llm-notice" role="alert">起動・送信結果が未確認です。再接続して確認してください。重複を避けるため自動再送・再起動しません。</p>}
    <div ref={scroll} className="pf-llm-messages" role="log" aria-label="会話">
      {query.isPending && <p>会話を読み込み中…</p>}
      {state === 'empty' && <p>最初のメッセージを送ると会話を開始します。指示は仕様のフラグメントにも保存します。</p>}
      {query.data && state !== 'empty' && <p className="meta">AIの応答は各セッションの直近100件を表示します。</p>}
      {query.data?.messages.map(message => <article key={message.id} className={`pf-llm-message ${message.role}`}>
        <strong>{message.role === 'user' ? 'あなた' : message.role === 'assistant' ? 'AI' : '確認事項'}</strong>
        <p>{message.text}</p>
      </article>)}
    </div>
    {(disconnected || state === 'ended' || state === 'uncertain' || query.isError) && <button className="primary" type="button"
      disabled={mutation.isPending} onClick={() => mutation.mutate({ action: 'resume' })}>同じ会話に再接続</button>}
    <form className="pf-llm-compose" onSubmit={event => {
      event.preventDefault(); if (canSend && text.trim()) mutation.mutate({ action: 'messages', message: text.trim() });
    }}>
      <textarea aria-label="相談内容" rows={3} maxLength={8000} value={text} onChange={event => setText(event.target.value)} placeholder="仕様や設計について相談…" />
      <button className="primary" type="submit" disabled={!canSend || !text.trim()}>{mutation.isPending ? '処理中…' : '送信'}</button>
    </form>
  </aside>;
}
