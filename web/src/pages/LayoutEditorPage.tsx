import React from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type LayoutObject, type PfObject, type Domain } from '../lib/api.ts';
import { PlacementCanvas, type PlacementItem, type PlacementState, type WirePartKind } from '../components/PlacementCanvas.tsx';
import { Preview3D } from '../components/Preview3D.tsx';

const DEFAULT_SCREEN = { width: 1280, height: 720 };

const PARTS: Array<{ kind: WirePartKind; label: string; color: string; sx: number; sy: number }> = [
  { kind: 'nav', label: 'Navigation', color: '#64748b', sx: 10, sy: 0.8 },
  { kind: 'panel', label: 'Panel', color: '#94a3b8', sx: 4, sy: 3 },
  { kind: 'card', label: 'Card', color: '#8b5cf6', sx: 3, sy: 2 },
  { kind: 'text', label: 'Text label', color: '#111827', sx: 2.5, sy: 0.5 },
  { kind: 'input', label: 'Input', color: '#0ea5e9', sx: 3, sy: 0.6 },
  { kind: 'button', label: 'Button', color: '#22c55e', sx: 2, sy: 0.7 },
  { kind: 'toggle', label: 'Toggle', color: '#f59e0b', sx: 1.4, sy: 0.6 },
  { kind: 'listbox', label: 'List box', color: '#14b8a6', sx: 3.5, sy: 3 },
];

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
  const specsQ = useQuery({
    queryKey: ['specs', pid],
    queryFn: () => api.listSpecs(pid!),
    enabled: !!pid,
  });
  const graphQ = useQuery({
    queryKey: ['graph', pid, lid],
    queryFn: () => api.getGraph(pid!, 'scene', lid!),
    enabled: !!pid && !!lid,
  });

  const [state, setState] = React.useState<PlacementState>({ items: [], selectedId: null });
  const [history, setHistory] = React.useState<PlacementState[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [mode, setMode] = React.useState<'2d' | '3d'>('2d');
  const [screen, setScreen] = React.useState(DEFAULT_SCREEN);
  const [createdObjects, setCreatedObjects] = React.useState<Record<string, PfObject>>({});
  const [listRowsText, setListRowsText] = React.useState('Item A\nItem B\nItem C\nItem D\nItem E');
  const [limitListHeight, setLimitListHeight] = React.useState(true);
  const [featureQuery, setFeatureQuery] = React.useState('');
  const [draftLabel, setDraftLabel] = React.useState('');

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
    for (const o of Object.values(createdObjects)) m.set(o.id, o);
    return m;
  }, [objectsQ.data, createdObjects]);

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
      setDirty(true);
      return h.slice(0, -1);
    });
  }

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

  function addPlacement(objectId: string, opts: Partial<PlacementItem> = {}): void {
    const tempId = `tmp_${Math.random().toString(36).slice(2, 10)}`;
    pushHistory({
      items: [
        ...state.items,
        {
          id: tempId,
          objectId,
          x: opts.x ?? Math.min(screen.width - 80, 120 + state.items.length * 18),
          y: opts.y ?? Math.min(screen.height - 60, 120 + state.items.length * 18),
          sx: opts.sx ?? 1,
          sy: opts.sy ?? 1,
          lock: opts.lock ?? false,
          meta: opts.meta,
        },
      ],
      selectedId: tempId,
    });
  }

  function addObject(obj: PfObject): void {
    addPlacement(obj.id, { sx: 2, sy: 1, meta: { kind: kindFromShape(obj.placeholder_shape), status: 'implemented' } });
  }

  async function ensureWireDomain(): Promise<string> {
    const existing = domainsQ.data?.items.find((d) => d.name === 'UI Wireframe') ?? domainsQ.data?.items[0];
    if (existing) return existing.id;
    if (!pid) throw new Error('missing project id');
    const created = await api.createDomain(pid, {
      name: 'UI Wireframe',
      description: 'Wireframe-only parts and draft feature controls',
      color: '#64748b',
    });
    await qc.invalidateQueries({ queryKey: ['domains', pid] });
    return created.domain.id;
  }

  async function createWireObject(input: {
    label: string;
    kind: WirePartKind;
    color: string;
  }): Promise<PfObject> {
    if (!pid) throw new Error('missing project id');
    const domainId = await ensureWireDomain();
    const created = await api.createObject(pid, {
      domain_id: domainId,
      label: `${input.label} ${new Date().toLocaleTimeString()}`,
      placeholder_shape: input.kind,
      placeholder_color: input.color,
    });
    setCreatedObjects((m) => ({ ...m, [created.object.id]: created.object }));
    await qc.invalidateQueries({ queryKey: ['objects', pid] });
    return created.object;
  }

  const addWirePartM = useMutation({
    mutationFn: createWireObject,
    onSuccess: (obj, vars) => {
      addPlacement(obj.id, {
        sx: vars.kind === 'listbox' ? 3.5 : vars.kind === 'nav' ? 10 : vars.kind === 'button' ? 2 : 2.5,
        sy: vars.kind === 'listbox' ? 3 : vars.kind === 'nav' ? 0.8 : vars.kind === 'button' ? 0.7 : 1,
        meta: {
          kind: vars.kind,
          status: vars.kind === 'draft-button' ? 'draft' : 'implemented',
          listRows: vars.kind === 'listbox' ? listRowsText.split('\n').filter(Boolean) : undefined,
          limitListHeight: vars.kind === 'listbox' ? limitListHeight : undefined,
        },
      });
    },
  });

  const linkM = useMutation({
    mutationFn: async () => {
      if (!pid || !lid) throw new Error('missing ids');
      return api.studioAnatomiaLink(pid, {
        target_kind: 'scene',
        target_id: lid,
        query: featureQuery || '画面外にある実装済み機能の呼び出し口として配置できる機能を調べる',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph', pid, lid] });
    },
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const items = state.items.map((it, index) => ({
        id: it.id.startsWith('tmp_') ? undefined : it.id,
        object_id: it.objectId,
        position: [it.x, it.y, 0],
        rotation: [0, 0, 0],
        scale: [it.sx, it.sy, 1],
        lock_transform: it.lock,
        ordinal: index,
      }));
      return api.putLayoutObjects(pid!, lid!, items);
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['layout', pid, lid] });
    },
  });

  function snapSelected(edge: 'left' | 'right' | 'top' | 'bottom'): void {
    const items = state.items.map((it) => {
      if (it.id !== state.selectedId) return it;
      const w = 80 * it.sx;
      const h = 80 * it.sy;
      if (edge === 'left') return { ...it, x: w / 2 };
      if (edge === 'right') return { ...it, x: screen.width - w / 2 };
      if (edge === 'top') return { ...it, y: h / 2 };
      return { ...it, y: screen.height - h / 2 };
    });
    pushHistory({ ...state, items });
  }

  function distribute(axis: 'x' | 'y'): void {
    const sorted = [...state.items].sort((a, b) => axis === 'x' ? a.x - b.x : a.y - b.y);
    if (sorted.length < 3) return;
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const span = axis === 'x' ? last.x - first.x : last.y - first.y;
    const idToValue = new Map<string, number>();
    sorted.forEach((it, index) => {
      idToValue.set(it.id, (axis === 'x' ? first.x : first.y) + (span * index) / (sorted.length - 1));
    });
    const items = state.items.map((it) => axis === 'x' ? { ...it, x: idToValue.get(it.id) ?? it.x } : { ...it, y: idToValue.get(it.id) ?? it.y });
    pushHistory({ ...state, items });
  }

  function updateSelectedList(): void {
    const items = state.items.map((it) => (
      it.id === state.selectedId
        ? {
            ...it,
            meta: {
              ...it.meta,
              kind: 'listbox' as const,
              listRows: listRowsText.split('\n').filter(Boolean),
              limitListHeight,
            },
          }
        : it
    ));
    pushHistory({ ...state, items });
  }

  function kindFromShape(shape: string): WirePartKind {
    if (PARTS.some((p) => p.kind === shape)) return shape as WirePartKind;
    if (shape === 'linked-button' || shape === 'draft-button') return shape;
    return 'placeholder';
  }

  if (!pid || !lid) return <p>missing ids</p>;
  if (layoutQ.isLoading) return <p>loading...</p>;
  if (!layoutQ.data) return <p>not found</p>;

  const selected = state.items.find((i) => i.id === state.selectedId) ?? null;

  return (
    <>
      <div className="panel wireframe-header">
        <div>
          <h2>{layoutQ.data.layout.name}</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {layoutQ.data.layout.kind} / {state.items.length} placements {dirty && '(unsaved)'}
          </div>
        </div>
        <div className="placement-toolbar">
          <button className="ghost" type="button" onClick={undo} disabled={history.length === 0}>Undo</button>
          <button className="primary" type="button" disabled={!dirty || saveM.isPending} onClick={() => saveM.mutate()}>
            Save ({state.items.length})
          </button>
        </div>
      </div>

      <div className="wireframe-layout">
        <aside className="panel wireframe-side">
          <h3>Screen</h3>
          <div className="foundation-form compact-form">
            <label className="simple-field">
              <span>Width</span>
              <input type="number" value={screen.width} min={240} onChange={(e) => setScreen((s) => ({ ...s, width: Number(e.target.value) || s.width }))} />
            </label>
            <label className="simple-field">
              <span>Height</span>
              <input type="number" value={screen.height} min={240} onChange={(e) => setScreen((s) => ({ ...s, height: Number(e.target.value) || s.height }))} />
            </label>
            <select value={`${screen.width}x${screen.height}`} onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              if (w && h) setScreen({ width: w, height: h });
            }}>
              <option value="1280x720">Desktop 1280 x 720</option>
              <option value="1440x900">Desktop 1440 x 900</option>
              <option value="390x844">Mobile 390 x 844</option>
              <option value="834x1194">Tablet 834 x 1194</option>
            </select>
          </div>

          <h3>Parts</h3>
          <div className="part-grid">
            {PARTS.map((p) => (
              <button key={p.kind} type="button" className="part-button" onClick={() => addWirePartM.mutate(p)}>
                <span className="part-swatch" style={{ background: p.color }} />
                {p.label}
              </button>
            ))}
          </div>

          <h3>Project Objects</h3>
          <ul className="item-list scroll-list">
            {objectsQ.data?.items.map((o) => {
              const d = domainsById.get(o.domain_id);
              const color = d?.color ?? o.placeholder_color;
              return (
                <li key={o.id} className="item-row">
                  <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 14, height: 14, background: color, borderRadius: 3 }} />
                    {o.label}
                  </div>
                  <div className="meta">{d?.name} / {o.placeholder_shape}</div>
                  <div style={{ marginTop: 6 }}>
                    <button type="button" className="ghost" onClick={() => addObject(o)}>Add</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        <section>
          <div className="placement-toolbar">
            <button type="button" className="ghost" onClick={() => setMode(mode === '2d' ? '3d' : '2d')}>
              {mode === '2d' ? 'Switch to 3D preview' : 'Switch to 2D editor'}
            </button>
            <button type="button" className="ghost" disabled={!selected} onClick={() => snapSelected('left')}>Snap L</button>
            <button type="button" className="ghost" disabled={!selected} onClick={() => snapSelected('right')}>Snap R</button>
            <button type="button" className="ghost" disabled={!selected} onClick={() => snapSelected('top')}>Snap T</button>
            <button type="button" className="ghost" disabled={!selected} onClick={() => snapSelected('bottom')}>Snap B</button>
            <button type="button" className="ghost" disabled={state.items.length < 3} onClick={() => distribute('x')}>Distribute X</button>
            <button type="button" className="ghost" disabled={state.items.length < 3} onClick={() => distribute('y')}>Distribute Y</button>
          </div>
          {mode === '2d' ? (
            <div className="placement-stage wireframe-stage">
              <PlacementCanvas
                state={state}
                screen={screen}
                onChange={(next) => pushHistory(next)}
                colorFor={(it) => {
                  const obj = objectsById.get(it.objectId);
                  const dom = obj ? domainsById.get(obj.domain_id) : undefined;
                  return dom?.color ?? obj?.placeholder_color ?? '#888888';
                }}
                labelFor={(it) => objectsById.get(it.objectId)?.label ?? '(unknown)'}
                kindFor={(it) => kindFromShape(objectsById.get(it.objectId)?.placeholder_shape ?? '')}
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
                return dom?.color ?? obj?.placeholder_color ?? '#888888';
              }}
            />
          )}
        </section>

        <aside className="panel wireframe-side">
          <h3>Selected</h3>
          {selected ? (
            <div className="foundation-form compact-form">
              <div className="meta">
                x={selected.x.toFixed(0)} y={selected.y.toFixed(0)} w={(selected.sx * 80).toFixed(0)} h={(selected.sy * 80).toFixed(0)}
              </div>
              <label className="simple-field">
                <span>List rows</span>
                <textarea rows={5} value={listRowsText} onChange={(e) => setListRowsText(e.target.value)} />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={limitListHeight} onChange={(e) => setLimitListHeight(e.target.checked)} />
                Limit list height
              </label>
              <button type="button" className="ghost" onClick={updateSelectedList}>Apply listbox</button>
            </div>
          ) : (
            <div className="meta">Select a part to edit placement and listbox options.</div>
          )}

          <h3>Feature Wiring</h3>
          <div className="foundation-form compact-form">
            <textarea
              rows={3}
              value={featureQuery}
              onChange={(e) => setFeatureQuery(e.target.value)}
              placeholder="呼び出したい実装済み機能"
            />
            <button type="button" className="ghost" disabled={linkM.isPending} onClick={() => linkM.mutate()}>
              Check with Sonnet
            </button>
          </div>
          {linkM.error ? <div className="meta err-text">{String(linkM.error)}</div> : null}
          <ul className="item-list scroll-list">
            {(graphQ.data?.nodes ?? []).filter((n) => n.status !== 'dismissed').map((n) => (
              <li key={n.id} className="item-row">
                <div className="label">{n.label}</div>
                <div className="meta">{n.node_type} / {n.source}</div>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => addWirePartM.mutate({ kind: 'linked-button', label: n.label, color: '#16a34a' })}
                >
                  Place wired button
                </button>
              </li>
            ))}
          </ul>

          <h3>Draft Button</h3>
          <div className="foundation-form compact-form">
            <input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="未実装機能名" />
            <button
              type="button"
              className="ghost"
              onClick={() => addWirePartM.mutate({ kind: 'draft-button', label: draftLabel || 'Draft feature', color: '#f97316' })}
            >
              Place draft button
            </button>
          </div>

          <h3>Specs</h3>
          <ul className="item-list scroll-list compact-list">
            {specsQ.data?.items.slice(0, 12).map((s) => (
              <li key={s.id} className="item-row">
                <div className="label">{s.title}</div>
                <div className="meta">{s.status} / {s.priority}</div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

export type { LayoutObject };
