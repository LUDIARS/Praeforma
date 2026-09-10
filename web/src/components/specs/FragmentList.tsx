import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fragmentApi, FRAGMENT_PAGE_SIZE } from '../../lib/spec-fragments-api.ts';
import { FragmentCard } from './FragmentCard.tsx';

export function FragmentList({ pid }: { pid: string }): React.ReactElement {
  const client = useQueryClient();
  const [offset, setOffset] = React.useState(0);
  const [content, setContent] = React.useState('');
  const eventId = React.useRef<string | null>(null);
  const query = useQuery({ queryKey: ['spec-fragments', pid, offset], queryFn: () => fragmentApi.list(pid, offset) });
  const refresh = async (): Promise<void> => { await Promise.all([client.invalidateQueries({ queryKey: ['fragment-cleanup-todo', pid] }),client.invalidateQueries({ queryKey: ['spec-fragments', pid] }),client.invalidateQueries({queryKey:['spec-versions',pid]})]); };
  const create = useMutation({
    mutationFn: () => {
      eventId.current ??= crypto.randomUUID();
      return fragmentApi.create(pid, { content, sourceEventId: eventId.current });
    },
    onSuccess: async () => { setContent(''); eventId.current = null; setOffset(0); await refresh(); },
  });
  return <>
    <p>指示や思いつきを、そのまま残せます。数値目標・計測方法・条件・報酬も自由に記入できます。</p>
    {query.data?.canEdit && <form onSubmit={(event) => {
      event.preventDefault(); if (content.trim() && !create.isPending) create.mutate();
    }}>
      <label className="simple-field"><span>断片</span>
        <textarea rows={5} maxLength={20000} required disabled={create.isPending} value={content}
          onChange={(event) => { setContent(event.target.value); eventId.current = null; create.reset(); }} />
      </label>
      <button type="submit" className="primary" disabled={create.isPending || !content.trim()}>
        {create.isPending ? '登録中…' : '断片を登録'}</button>
      {create.isError && <p role="alert">登録を確認できませんでした。入力は残っています。そのまま再送すると重複を防いで保存します。</p>}
      {create.isSuccess && <p role="status">保存しました。</p>}
    </form>}
    {query.isPending && <p role="status">読み込み中…</p>}
    {query.isError && <p role="alert">取得できませんでした。<button type="button" onClick={() => { void query.refetch(); }}>再取得</button></p>}
    {query.isSuccess && <>
      {query.data.items.length === 0 && <p>断片はありません。</p>}
      {query.data.items.map((fragment) => <FragmentCard key={fragment.id} fragment={fragment} canEdit={query.data.canEdit} onChanged={refresh} />)}
      <div className="simple-actions"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - FRAGMENT_PAGE_SIZE))}>前へ</button>
        <span>{Math.floor(offset / FRAGMENT_PAGE_SIZE) + 1}ページ</span><button type="button" disabled={!query.data.hasMore} onClick={() => setOffset(offset + FRAGMENT_PAGE_SIZE)}>次へ</button></div>
    </>}
  </>;
}
