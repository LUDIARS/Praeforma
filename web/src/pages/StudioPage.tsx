// StudioPage — 要件定義モード。
//
// UX: 中央テキストボックス + 進捗ステップ のシンプル構成で、
//   ① 資料取込(任意) → ② メニュー(ドメイン/シーン × 新規/調整) → ③ 要件定義(LLM補助)
//   → ④ Anatomia 関連処理検索 → ⑤ グラフ調整 → ② に戻る、 のループを回す。

import React from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type GraphNode,
  type GraphEdge,
  type IngestProposal,
  type SuggestedRequirement,
  type UxTargetKind,
} from '../lib/api.ts';

type Phase = 'menu' | 'ingest' | 'target' | 'requirements' | 'graph';
type MenuOp = 'create' | 'adjust';

const STEPS = ['① 資料(任意)', '② メニュー', '③ 要件定義', '④ Anatomia', '⑤ グラフ'];

function stepIndexFor(phase: Phase): number {
  switch (phase) {
    case 'ingest': return 0;
    case 'menu': return 1;
    case 'target': return 1;
    case 'requirements': return 2;
    case 'graph': return 4;
  }
}

function genCode(targetName: string): string {
  const base =
    targetName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16) || 'REQ';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REQ-${base}-${suffix}`;
}

export function StudioPage(): React.ReactElement {
  const { pid } = useParams();
  const qc = useQueryClient();

  const [phase, setPhase] = React.useState<Phase>('menu');
  const [menu, setMenu] = React.useState<{ op: MenuOp; kind: UxTargetKind } | null>(null);
  const [target, setTarget] = React.useState<{ kind: UxTargetKind; id: string; name: string } | null>(null);
  const [central, setCentral] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [status, setStatus] = React.useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [proposal, setProposal] = React.useState<IngestProposal | null>(null);
  const [suggestions, setSuggestions] = React.useState<Array<SuggestedRequirement & { _sel: boolean }>>([]);

  const domainsQ = useQuery({ queryKey: ['domains', pid], queryFn: () => api.listDomains(pid!), enabled: !!pid });
  const scenesQ = useQuery({ queryKey: ['layouts', pid], queryFn: () => api.listLayouts(pid!), enabled: !!pid });

  function ok(msg: string) { setStatus({ msg, kind: 'ok' }); }
  function fail(e: unknown) {
    const m = (e as { body?: { error?: string } })?.body?.error ?? (e as Error)?.message ?? 'error';
    setStatus({ msg: m, kind: 'err' });
  }

  function resetTo(p: Phase) {
    setPhase(p);
    setStatus(null);
    if (p === 'menu') { setMenu(null); setSuggestions([]); setProposal(null); }
  }

  // ── mutations ──────────────────────────────────────────────────────────
  const ingestM = useMutation({
    mutationFn: () => api.studioIngest(pid!, { material: central, kind: 'spec-doc' }),
    onSuccess: (r) => { setProposal(r.proposal); ok('下書きを生成しました'); },
    onError: fail,
  });

  const createTargetM = useMutation({
    mutationFn: async () => {
      if (menu?.kind === 'domain') return api.createDomain(pid!, { name: central, description: desc });
      const l = await api.createLayout(pid!, { name: central });
      return l;
    },
    onSuccess: (r) => {
      const id = 'domain' in r ? r.domain.id : r.layout.id;
      const name = 'domain' in r ? r.domain.name : r.layout.name;
      setTarget({ kind: menu!.kind, id, name });
      qc.invalidateQueries({ queryKey: [menu!.kind === 'domain' ? 'domains' : 'layouts', pid] });
      setCentral(''); setDesc('');
      setPhase('requirements');
      ok(`${menu!.kind === 'domain' ? 'ドメイン' : 'シーン'}「${name}」を作成`);
    },
    onError: fail,
  });

  const suggestM = useMutation({
    mutationFn: () => api.studioSuggest(pid!, { target_kind: target!.kind, target_id: target!.id, note: central }),
    onSuccess: (r) => {
      setSuggestions(r.requirements.map((x) => ({ ...x, _sel: true })));
      ok(`${r.requirements.length} 件の要件を提案`);
    },
    onError: fail,
  });

  const confirmM = useMutation({
    mutationFn: async () => {
      const chosen = suggestions.filter((s) => s._sel);
      const dbKind = target!.kind === 'scene' ? ('layout' as const) : ('domain' as const);
      for (const s of chosen) {
        await api.createSpec(pid!, {
          code: s.code || genCode(target!.name),
          title: s.title,
          description: s.description,
          priority: s.priority,
          category: s.category,
          preconditions: s.preconditions,
          postconditions: s.postconditions,
          targets: [{ kind: dbKind, ref_id: target!.id }],
          acceptance: s.acceptance.map((a) => ({ text: a.text, level: a.level, kind: a.kind })),
        });
      }
      return chosen.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['specs', pid] }); ok(`${n} 件の要件を確定`); },
    onError: fail,
  });

  const graphQ = useQuery({
    queryKey: ['graph', pid, target?.kind, target?.id],
    queryFn: () => api.getGraph(pid!, target!.kind, target!.id),
    enabled: !!pid && !!target && phase === 'graph',
  });

  const linkM = useMutation({
    mutationFn: () => api.studioAnatomiaLink(pid!, { target_kind: target!.kind, target_id: target!.id, query: central || undefined }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['graph', pid] }); ok(r.summary ?? `グラフ更新 (${r.nodes.length} nodes)`); },
    onError: fail,
  });

  const nodeStatusM = useMutation({
    mutationFn: (v: { nid: string; status: GraphNode['status'] }) => api.patchGraphNode(pid!, v.nid, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graph', pid] }),
    onError: fail,
  });
  const nodeDelM = useMutation({
    mutationFn: (nid: string) => api.deleteGraphNode(pid!, nid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graph', pid] }),
    onError: fail,
  });

  if (!pid) return <p>missing project id</p>;

  const targetList = (kind: UxTargetKind) =>
    kind === 'domain'
      ? (domainsQ.data?.items ?? []).map((d) => ({ id: d.id, name: d.name }))
      : (scenesQ.data?.items ?? []).map((l) => ({ id: l.id, name: l.name }));

  return (
    <>
      <div className="panel">
        <h2>要件定義モード <span className="role-badge">Studio</span></h2>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          ドメイン/シーンを宣言し、 LLM 補助で要件を具体化 → Anatomia(MUSA/Thaleia 経由)で関連処理グラフを更新するループ。
          <Link to={`/projects/${pid}`} style={{ marginLeft: 8 }}>← プロジェクトへ</Link>
        </p>
      </div>

      {/* 進捗ステップ */}
      <div className="stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i === stepIndexFor(phase) ? 'active' : ''}`}>{s}</div>
        ))}
      </div>

      {target && phase !== 'menu' && (
        <div className="panel" style={{ padding: '8px 16px' }}>
          対象: <strong>{target.kind === 'domain' ? 'ドメイン' : 'シーン'}「{target.name}」</strong>
        </div>
      )}

      {/* ② メニュー */}
      {phase === 'menu' && (
        <div className="panel">
          <h3>メニュー</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              ['domain', 'create', 'ドメインを新規作成'],
              ['domain', 'adjust', 'ドメインを調整'],
              ['scene', 'create', 'シーンを新規作成'],
              ['scene', 'adjust', 'シーンを調整'],
            ] as Array<[UxTargetKind, MenuOp, string]>).map(([kind, op, label]) => (
              <button
                key={label}
                type="button"
                className="ghost"
                style={{ padding: '18px', fontWeight: 600 }}
                onClick={() => {
                  setMenu({ op, kind });
                  setTarget(null);
                  setCentral(''); setDesc('');
                  setPhase('target');
                  setStatus(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="ghost" onClick={() => resetTo('ingest')}>
              ① 資料(仕様書/画面遷移/Anatomia解析)から下書きを作る
            </button>
          </div>
        </div>
      )}

      {/* ① ingest */}
      {phase === 'ingest' && (
        <div className="panel foundation-form">
          <h3>① 資料から下書き</h3>
          <label className="simple-field">
            <span>資料テキスト (仕様書 / 画面遷移リスト / Anatomia 解析結果)</span>
            <textarea rows={10} value={central} onChange={(e) => setCentral(e.target.value)} placeholder="ここに資料を貼り付け…" />
          </label>
          <div className="simple-actions">
            <button type="button" className="ghost" onClick={() => resetTo('menu')}>← メニュー</button>
            <button type="button" className="primary" disabled={!central || ingestM.isPending} onClick={() => ingestM.mutate()}>
              {ingestM.isPending ? '生成中…' : '下書きを生成'}
            </button>
          </div>
          {proposal && (
            <div style={{ marginTop: 12 }}>
              <h3>提案されたドメイン</h3>
              <ul className="item-list">
                {proposal.domains.map((d, i) => (
                  <li key={i} className="item-row">
                    <div className="label">{d.name}</div>
                    <div className="meta">{d.description}</div>
                    <button type="button" className="ghost" style={{ marginTop: 6 }}
                      onClick={() => api.createDomain(pid, { name: d.name, description: d.description })
                        .then(() => { qc.invalidateQueries({ queryKey: ['domains', pid] }); ok(`ドメイン「${d.name}」作成`); }).catch(fail)}>
                      このドメインを作成
                    </button>
                  </li>
                ))}
              </ul>
              <h3>提案されたシーン</h3>
              <ul className="item-list">
                {proposal.scenes.map((s, i) => (
                  <li key={i} className="item-row">
                    <div className="label">{s.name}</div>
                    <div className="meta">{s.description}</div>
                    <button type="button" className="ghost" style={{ marginTop: 6 }}
                      onClick={() => api.createLayout(pid, { name: s.name })
                        .then(() => { qc.invalidateQueries({ queryKey: ['layouts', pid] }); ok(`シーン「${s.name}」作成`); }).catch(fail)}>
                      このシーンを作成
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ② target: create or adjust */}
      {phase === 'target' && menu && (
        <div className="panel foundation-form">
          <h3>{menu.kind === 'domain' ? 'ドメイン' : 'シーン'}を{menu.op === 'create' ? '新規作成' : '選択して調整'}</h3>
          {menu.op === 'create' ? (
            <>
              <label className="simple-field">
                <span>名前</span>
                <input type="text" value={central} onChange={(e) => setCentral(e.target.value)} placeholder={menu.kind === 'domain' ? '例: Player' : '例: メインメニュー'} />
              </label>
              {menu.kind === 'domain' && (
                <label className="simple-field">
                  <span>概要 (任意)</span>
                  <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
                </label>
              )}
              <div className="simple-actions">
                <button type="button" className="ghost" onClick={() => resetTo('menu')}>← メニュー</button>
                <button type="button" className="primary" disabled={!central || createTargetM.isPending} onClick={() => createTargetM.mutate()}>
                  作成して要件定義へ
                </button>
              </div>
            </>
          ) : (
            <>
              <ul className="item-list">
                {targetList(menu.kind).map((t) => (
                  <li key={t.id} className="item-row" style={{ cursor: 'pointer' }}
                    onClick={() => { setTarget({ kind: menu.kind, id: t.id, name: t.name }); setCentral(''); setPhase('requirements'); setStatus(null); }}>
                    <div className="label">{t.name}</div>
                  </li>
                ))}
                {targetList(menu.kind).length === 0 && <p style={{ color: 'var(--muted)' }}>まだありません。新規作成してください。</p>}
              </ul>
              <div className="simple-actions">
                <button type="button" className="ghost" onClick={() => resetTo('menu')}>← メニュー</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ③ requirements */}
      {phase === 'requirements' && target && (
        <div className="panel foundation-form">
          <h3>③ 要件定義</h3>
          <label className="simple-field">
            <span>今やりたいこと / 補足 (LLM への指示。 空でも可)</span>
            <textarea rows={4} value={central} onChange={(e) => setCentral(e.target.value)} placeholder="例: 移動と当たり判定まわりの基本要件を出して" />
          </label>
          <div className="simple-actions">
            <button type="button" className="ghost" onClick={() => resetTo('menu')}>← メニュー</button>
            <button type="button" className="primary" disabled={suggestM.isPending} onClick={() => suggestM.mutate()}>
              {suggestM.isPending ? '生成中…' : 'AI に要件を提案させる'}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3>提案 ({suggestions.filter((s) => s._sel).length}/{suggestions.length} 選択)</h3>
              <ul className="item-list">
                {suggestions.map((s, i) => (
                  <li key={i} className={`item-row ${s._sel ? 'active' : ''}`}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={s._sel} onChange={(e) => setSuggestions((prev) => prev.map((x, j) => j === i ? { ...x, _sel: e.target.checked } : x))} />
                      <span>
                        <span className="label">{s.title}</span>
                        <span className="role-badge">{s.priority}</span>
                        <span className="role-badge viewer">{s.category}</span>
                        <div className="meta">{s.description}</div>
                        {s.acceptance.length > 0 && (
                          <div className="meta">受入: {s.acceptance.map((a) => a.text).join(' / ')}</div>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="simple-actions">
                <button type="button" className="primary" disabled={confirmM.isPending || suggestions.every((s) => !s._sel)} onClick={() => confirmM.mutate()}>
                  {confirmM.isPending ? '保存中…' : '選択した要件を確定 (spec 作成)'}
                </button>
                <button type="button" className="ghost" onClick={() => { setCentral(''); setPhase('graph'); setStatus(null); }}>
                  ④ Anatomia で関連処理を検索 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ④⑤ graph */}
      {phase === 'graph' && target && (
        <div className="panel foundation-form">
          <h3>④ Anatomia リンク / ⑤ グラフ調整</h3>
          <label className="simple-field">
            <span>検索クエリ (任意。 空なら対象名から自動)</span>
            <input type="text" value={central} onChange={(e) => setCentral(e.target.value)} placeholder={`例: ${target.name} の移動処理`} />
          </label>
          <div className="simple-actions">
            <button type="button" className="ghost" onClick={() => resetTo('menu')}>← メニュー</button>
            <button type="button" className="primary" disabled={linkM.isPending} onClick={() => linkM.mutate()}>
              {linkM.isPending ? 'リレー中…' : 'MUSA(Thaleia)経由で Anatomia を検索 → グラフ更新'}
            </button>
          </div>

          {graphQ.data?.latest_run && (
            <div className="meta" style={{ marginTop: 8 }}>
              直近 run: {graphQ.data.latest_run.status} / nodes {graphQ.data.latest_run.node_count} / edges {graphQ.data.latest_run.edge_count}
            </div>
          )}

          <h3>ノード ({graphQ.data?.nodes.length ?? 0})</h3>
          {graphQ.isLoading && <p>loading…</p>}
          <ul className="item-list">
            {(graphQ.data?.nodes ?? []).map((n: GraphNode) => (
              <li key={n.id} className={`item-row ${n.status === 'dismissed' ? '' : 'active'}`} style={{ opacity: n.status === 'dismissed' ? 0.5 : 1 }}>
                <div className="label">
                  {n.label} <span className="role-badge viewer">{n.node_type}</span>
                  <span className="role-badge">{n.status}</span>
                  {n.source === 'manual' && <span className="role-badge viewer">manual</span>}
                </div>
                {n.anatomia_ref?.path != null && <div className="meta">{String(n.anatomia_ref.path)}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {n.status !== 'dismissed' ? (
                    <button type="button" className="ghost" onClick={() => nodeStatusM.mutate({ nid: n.id, status: 'dismissed' })}>除外</button>
                  ) : (
                    <button type="button" className="ghost" onClick={() => nodeStatusM.mutate({ nid: n.id, status: 'linked' })}>復帰</button>
                  )}
                  <button type="button" className="danger" onClick={() => nodeDelM.mutate(n.id)}>削除</button>
                </div>
              </li>
            ))}
          </ul>

          {(graphQ.data?.edges?.length ?? 0) > 0 && (
            <>
              <h3>関係 ({graphQ.data?.edges.length})</h3>
              <ul className="item-list">
                {(graphQ.data?.edges ?? []).map((e: GraphEdge) => {
                  const nodes = graphQ.data?.nodes ?? [];
                  const f = nodes.find((x) => x.id === e.from_node)?.label ?? e.from_node;
                  const t = nodes.find((x) => x.id === e.to_node)?.label ?? e.to_node;
                  return <li key={e.id} className="item-row"><div className="meta">{f} —[{e.relation}]→ {t}</div></li>;
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {status && (
        <div className={`toast ${status.kind}`} onAnimationEnd={() => undefined}>{status.msg}</div>
      )}
    </>
  );
}
