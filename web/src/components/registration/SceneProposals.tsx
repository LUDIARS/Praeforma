import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError, type Layout, type SceneProposal } from '../../lib/api.ts';

/** 取得失敗の理由を、利用者が次にすることが分かる文にする (spec/feature/anatomia-scene-proposals.md)。 */
export function proposalErrorMessage(error: unknown): string {
  const code = ((error as ApiError | null)?.body as { error?: string } | null)?.error;
  switch (code) {
    case 'anatomia_unconfigured':
      return 'Anatomia の接続先が未設定です。サーバーの設定 (Anatomia の URL) を確認してください。';
    case 'anatomia_repo_unset':
      return 'このプロジェクトに Anatomia のプロジェクトが紐付いていません。プロジェクト設定で Anatomia リポを指定してください。';
    case 'anatomia_project_not_found':
      return '紐付いた Anatomia のプロジェクトが見つかりません。Anatomia 側の登録名を確認してください。';
    case 'anatomia_unreachable':
    case 'anatomia_failed':
    case 'anatomia_bad_payload':
      return 'Anatomia からシーン解析を取得できませんでした。Anatomia が動いているか確認して、もう一度取得してください。';
    default:
      return 'シーン候補を取得できませんでした。';
  }
}

function ProposalRow({ pid, proposal }: { pid: string; proposal: SceneProposal }): React.ReactElement {
  const client = useQueryClient();
  const [name, setName] = React.useState(proposal.label);
  const [kind, setKind] = React.useState<Layout['kind']>(proposal.suggested_kind);
  const [description, setDescription] = React.useState(proposal.description ?? '');
  const mutation = useMutation({
    mutationFn: () => api.createLayout(pid, {
      name: name.trim(),
      description: description.trim(),
      kind,
      anatomia_scene_id: proposal.scene_id,
    }),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['scene-proposals', pid] }),
        client.invalidateQueries({ queryKey: ['layouts', pid] }),
        client.invalidateQueries({ queryKey: ['domain-definitions', pid] }),
      ]);
    },
  });
  const duplicate = ((mutation.error as ApiError | null)?.body as { error?: string } | null)?.error === 'anatomia_scene_already_registered';
  const evidence = proposal.evidence;
  return <li className="item-row" data-focus={proposal.label}>
    <form className="foundation-form" onSubmit={(event) => {
      event.preventDefault();
      if (name.trim() && !mutation.isPending) mutation.mutate();
    }}>
      <div>
        <strong>{proposal.label}</strong>
        <span className="muted"> （解析元: {proposal.scene_id} / {proposal.kind} / {proposal.origin}）</span>
      </div>
      {evidence && <p className="muted">
        根拠: {evidence.path}:{evidence.start_line}–{evidence.end_line}
        {evidence.reason ? ` — ${evidence.reason}` : ''}
      </p>}
      <fieldset disabled={mutation.isPending} style={{ border: 0, padding: 0 }} className="foundation-form">
        <label className="simple-field"><span>シーン名</span>
          <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="simple-field"><span>種類</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as Layout['kind'])}>
            <option value="ui-2d">UI（2D）</option><option value="world-2d">ワールド（2D）</option><option value="world-3d">ワールド（3D）</option>
          </select>
        </label>
        <label className="simple-field"><span>説明</span>
          <textarea maxLength={2000} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="simple-actions"><button className="primary" type="submit" disabled={!name.trim()}>
          {mutation.isPending ? '登録中…' : 'このシーンを登録'}
        </button></div>
      </fieldset>
      {mutation.isError && <p role="alert">{duplicate
        ? 'このシーンは既に登録されています。一覧を更新しました。'
        : '登録できませんでした。編集権限を確認してください。入力は残っています。'}</p>}
    </form>
  </li>;
}

/** Anatomia の解析シーンからシーン登録の候補を出し、利用者が確認・調整して登録する。 */
export function SceneProposals({ pid }: { pid: string }): React.ReactElement {
  const query = useQuery({
    queryKey: ['scene-proposals', pid],
    queryFn: () => api.listSceneProposals(pid),
    enabled: false,
    retry: false,
  });
  const pending = query.data?.proposals.filter((p) => !p.registered_layout_id) ?? [];
  const registered = query.data?.proposals.filter((p) => p.registered_layout_id) ?? [];
  return <section>
    <h3>Anatomia の解析からシーン候補を取得</h3>
    <div className="simple-actions">
      <button type="button" onClick={() => { void query.refetch(); }} disabled={query.isFetching}>
        {query.isFetching ? '取得中…' : query.data ? '候補を再取得' : '候補を取得'}
      </button>
    </div>
    {query.isError && <p role="alert">{proposalErrorMessage(query.error)}</p>}
    {query.data?.stale && <p role="status">
      Anatomia の解析が最新のコードより古い可能性があります{query.data.stale_reasons.length ? `（${query.data.stale_reasons.join(' / ')}）` : ''}。
      Anatomia で再解析してから取得し直すと正確です。
    </p>}
    {query.isSuccess && query.data.proposals.length === 0 && <p>Anatomia の解析にシーンが見つかりませんでした。</p>}
    {query.isSuccess && query.data.proposals.length > 0 && pending.length === 0 && <p>候補はすべて登録済みです。</p>}
    {pending.length > 0 && <ul className="item-list">
      {pending.map((proposal) => <ProposalRow key={proposal.scene_id} pid={pid} proposal={proposal} />)}
    </ul>}
    {registered.length > 0 && <p className="muted">登録済み: {registered.map((p) => p.label).join('、')}</p>}
  </section>;
}
