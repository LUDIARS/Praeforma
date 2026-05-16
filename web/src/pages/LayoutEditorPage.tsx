// Step 4: 配置 editor 2D MVP。
//
// 左ペイン: object パレット (ドメイン色別 placeholder)
// 中央: <canvas> ベースの 2D ステージ。 ドラッグ移動 / Del 削除 / Ctrl+Z undo
// 右ペイン: 選択 placement の transform + 紐付 spec + FB ピン

import React from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type LayoutObject, type PfObject, type Domain } from '../lib/api.ts';
import { PlacementCanvas, type PlacementState } from '../components/PlacementCanvas.tsx';
import { Preview3D } from '../components/Preview3D.tsx';

export function LayoutEditorPage(): React.ReactElement {
  const { pid, lid } = useParams();
  const qc = useQueryClient();

  const layoutQ = useQuery({
    queryKey: ['layout', pid, lid],
    queryFn: () => api.getLayout(pid!, lid!),
    enabled: !!pid && !!lid,
  });
  const objectsQ = useQuery({
    queryKey: ['objects', pid],
    queryFn: () => api.listObjects(pid!),
    enabled: !!pid,
  });
  const domainsQ = useQuery({
    queryKey: ['domains', pid],
    queryFn: () => api.listDomains(pid!),
    enabled: !!pid,
  });

  const [state, setState] = React.useState<PlacementState>({ items: [], selectedId: null });
  const [history, setHistory] = React.useState<PlacementState[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [mode, setMode] = React.useState<'2d' | '3d'>('2d');

  // server 側 layout_objects を local state に展開
  React.useEffect(() => {
    if (!layoutQ.data) return;
    setState({
      items: layoutQ.data.layout_objects.map((p) => ({
        id: p.id,
        objectId: p.object_id,
        x: p.position[0] ?? 0,
        y: p.position[1] ?? 0,
        sx: p.scale[0] ?? 1,
        sy: p.scale[1] ?? 1,
        lock: p.lock_transform,
      })),
      selectedId: null,
    });
    setDirty(false);
    setHistory([]);
  }, [layoutQ.data]);

  const objectsById = React.useMemo(() => {
    const m = new Map<string, PfObject>();
    for (const o of objectsQ.data?.items ?? []) m.set(o.id, o);
    return m;
  }, [objectsQ.data]);
  const domainsById = React.useMemo(() => {
    const m = new Map<string, Domain>();
    for (const d of domainsQ.data?.items ?? []) m.set(d.id, d);
    return m;
  }, [domainsQ.data]);

  function pushHistory(next: PlacementState): void {
    setHistory((h) => [...h.slice(-49), state]);
    setState(next);
    setDirty(true);
  }

  function undo(): void {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      if (!prev) return h;
      setState(prev);
      return h.slice(0, -1);
    });
  }

  // キーボード: Del 削除 / Ctrl+Z undo
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === 'Delete' && state.selectedId) {
        e.preventDefault();
        pushHistory({
          items: state.items.filter((i) => i.id !== state.selectedId),
          selectedId: null,
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  function addObject(obj: PfObject): void {
    const tempId = `tmp_${Math.random().toString(36).slice(2, 10)}`;
    pushHistory({
      items: [...state.items, { id: tempId, objectId: obj.id, x: 100, y: 100, sx: 1, sy: 1, lock: false }],
      selectedId: tempId,
    });
  }

  const saveM = useMutation({
    mutationFn: async () => {
      const items = state.items.map((it) => ({
        id: it.id.startsWith('tmp_') ? undefined : it.id,
        object_id: it.objectId,
        position: [it.x, it.y, 0],
        rotation: [0, 0, 0],
        scale: [it.sx, it.sy, 1],
        lock_transform: it.lock,
      }));
      return api.putLayoutObjects(pid!, lid!, items);
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['layout', pid, lid] });
    },
  });

  if (!pid || !lid) return <p>missing ids</p>;
  if (layoutQ.isLoading) return <p>loading…</p>;
  if (!layoutQ.data) return <p>not found</p>;

  return (
    <>
      <div className="panel">
        <h2>{layoutQ.data.layout.name}</h2>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {layoutQ.data.layout.kind} / {state.items.length} placements {dirty && '(unsaved)'}
        </div>
        <div className="placement-toolbar">
          <button className="ghost" type="button" onClick={undo} disabled={history.length === 0}>
            ↶ Undo
          </button>
          <button
            className="primary"
            type="button"
            disabled={!dirty || saveM.isPending}
            onClick={() => saveM.mutate()}
          >
            Save ({state.items.length} items)
          </button>
        </div>
      </div>

      <div className="split">
        {/* 左: object パレット */}
        <div className="panel">
          <h3>Objects (drag-to-stage は v0.2 / クリックで追加)</h3>
          <ul className="item-list">
            {objectsQ.data?.items.map((o) => {
              const d = domainsById.get(o.domain_id);
              const color = d?.color ?? o.placeholder_color;
              return (
                <li key={o.id} className="item-row">
                  <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      display: 'inline-block', width: 14, height: 14,
                      background: color, borderRadius: 3,
                    }} />
                    {o.label}
                  </div>
                  <div className="meta">{d?.name} / {o.placeholder_shape}</div>
                  <div style={{ marginTop: 6 }}>
                    <button type="button" className="ghost" onClick={() => addObject(o)}>
                      + Add to stage
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 中央: canvas */}
        <div>
          <div className="placement-toolbar">
            <button
              type="button"
              className={`ghost ${mode === '2d' ? '' : ''}`}
              onClick={() => setMode(mode === '2d' ? '3d' : '2d')}
              style={mode === '3d' ? { background: 'var(--accent-bg)', borderColor: 'var(--accent)' } : undefined}
            >
              {mode === '2d' ? '🪟 Switch to 3D preview' : '🧱 Switch to 2D editor'}
            </button>
          </div>
          {mode === '2d' ? (
            <div className="placement-stage">
              <PlacementCanvas
                state={state}
                onChange={(next) => pushHistory(next)}
                colorFor={(it) => {
                  const obj = objectsById.get(it.objectId);
                  const dom = obj ? domainsById.get(obj.domain_id) : undefined;
                  return dom?.color ?? obj?.placeholder_color ?? '#888';
                }}
                labelFor={(it) => objectsById.get(it.objectId)?.label ?? '(unknown)'}
              />
            </div>
          ) : (
            <Preview3D
              items={state.items}
              shapeFor={(it) => {
                const obj = objectsById.get(it.objectId);
                const s = obj?.placeholder_shape ?? 'cube';
                if (s === 'sphere' || s === 'plane' || s === 'cylinder') return s;
                return 'cube';
              }}
              colorFor={(it) => {
                const obj = objectsById.get(it.objectId);
                const dom = obj ? domainsById.get(obj.domain_id) : undefined;
                return dom?.color ?? obj?.placeholder_color ?? '#888';
              }}
            />
          )}
          {state.selectedId && (
            <div className="panel" style={{ marginTop: 12 }}>
              <h3>Selected placement</h3>
              {(() => {
                const it = state.items.find((i) => i.id === state.selectedId);
                if (!it) return null;
                return (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    id={it.id} x={it.x.toFixed(1)} y={it.y.toFixed(1)} sx={it.sx.toFixed(2)} sy={it.sy.toFixed(2)} lock={it.lock ? 'yes' : 'no'}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export type { LayoutObject };
