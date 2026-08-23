// 下段タブ「ドメイン」: Anatomia (正本) の一覧と Praeforma ドメインの突合 (§4.1)。
// 未登録バッジ / 候補 / 自動突合 / anatomia_repo の設定。
//
// @spec 4.1 正本と突合

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { screenFlowApi, errorText } from '../../lib/screen-flow-api.ts';

interface Props {
  pid: string;
  anatomiaRepo: string | null;
  onProjectChanged: () => void;
}

export function AnatomiaPanel({ pid, anatomiaRepo, onProjectChanged }: Props): React.ReactElement {
  const qc = useQueryClient();
  const [repoDraft, setRepoDraft] = React.useState(anatomiaRepo ?? '');
  React.useEffect(() => setRepoDraft(anatomiaRepo ?? ''), [anatomiaRepo]);

  const q = useQuery({
    queryKey: ['anatomia.domains', pid, anatomiaRepo],
    queryFn: () => screenFlowApi.anatomiaDomains(pid),
    enabled: Boolean(anatomiaRepo),
    retry: false,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['anatomia.domains', pid] });
    qc.invalidateQueries({ queryKey: ['domains', pid] });
  };
  const repoM = useMutation({
    mutationFn: () => screenFlowApi.setProjectAnatomiaRepo(pid, repoDraft.trim() || null),
    onSuccess: () => {
      onProjectChanged();
      invalidate();
    },
  });
  const matchM = useMutation({ mutationFn: () => screenFlowApi.anatomiaMatch(pid), onSuccess: invalidate });
  const linkM = useMutation({
    mutationFn: ({ did, name }: { did: string; name: string | null }) => screenFlowApi.setDomainAnatomia(pid, did, name),
    onSuccess: invalidate,
  });

  return (
    <div className="anatomia-panel">
      <form
        className="flow-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          repoM.mutate();
        }}
      >
        <label>
          Anatomia project:{' '}
          <input className="foundation-form" value={repoDraft} onChange={(e) => setRepoDraft(e.target.value)} placeholder="例: Praeforma" />
        </label>
        <button type="submit" className="ghost" disabled={repoM.isPending}>
          保存
        </button>
        <button type="button" className="ghost" disabled={!anatomiaRepo || matchM.isPending} onClick={() => matchM.mutate()}>
          同名を自動突合
        </button>
        {repoM.isError ? <span className="error">{errorText(repoM.error)}</span> : null}
      </form>
      {!anatomiaRepo ? <div className="muted">Anatomia project が未設定です。 ドメインは Anatomia が正本なので、 先に対象プロジェクトを指定してください。</div> : null}
      {q.isError ? (
        <div className="error">
          Anatomia 取得失敗: {errorText(q.error)}
          {errorText(q.error) === 'anatomia_unconfigured' ? ' (PRAEFORMA_ANATOMIA_URL 未設定)' : ''}
        </div>
      ) : null}
      {q.data ? (
        <div className="anatomia-grid">
          <div>
            <h4>Praeforma ドメイン → Anatomia</h4>
            <table>
              <tbody>
                {q.data.matches.map((m) => (
                  <tr key={m.domain_id}>
                    <td>{m.name}</td>
                    <td>
                      {m.linked ? (
                        <span className="pill ok">{m.anatomia_domain}</span>
                      ) : (
                        <span className="pill warn">Anatomia 未登録</span>
                      )}
                    </td>
                    <td>
                      {!m.linked && m.exact ? (
                        <button type="button" className="ghost" onClick={() => linkM.mutate({ did: m.domain_id, name: m.exact })}>
                          {m.exact} に結ぶ
                        </button>
                      ) : null}
                      {!m.linked && !m.exact && m.candidates.length > 0 ? (
                        <select
                          className="foundation-form"
                          defaultValue=""
                          onChange={(e) => e.target.value && linkM.mutate({ did: m.domain_id, name: e.target.value })}
                        >
                          <option value="">候補から選ぶ…</option>
                          {m.candidates.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {m.linked ? (
                        <button type="button" className="ghost" onClick={() => linkM.mutate({ did: m.domain_id, name: null })}>
                          解除
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4>Anatomia ドメイン一覧 ({q.data.repo})</h4>
            <table>
              <tbody>
                {q.data.catalog.map((d) => (
                  <tr key={d.name}>
                    <td>
                      <code>{d.name}</code>
                    </td>
                    <td className="muted">{d.description ?? '-'}</td>
                    <td className="muted">{d.implementorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
