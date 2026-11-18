// 遷移図 (シーン中心) の集約 — spec/feature/scene-map.md。
// シーンごとに、直接付いた仕様と、そのシーンに置いたアクター経由で付いた仕様を束ね、出入りする遷移を添える。
// DB を読まない純関数。route 側で行を集めて渡す。

import type { SceneMap, SceneMapScene, SceneMapSpec, SceneMapSpecSummary, SceneSpecVia } from '../../../shared/project-home.ts';

export interface SceneMapLayoutRow { id: string; name: string; description: string | null; kind: string; isDefault: boolean; anatomiaSceneId: string | null }
export interface SceneMapTransitionRow { id: string; fromLayoutId: string; toLayoutId: string; trigger: string; condition: string; label: string | null; ordinal: number }
export type SceneMapSpecRow = SceneMapSpecSummary;
export interface SceneMapTargetRow { specId: string; kind: string; refId: string }
export interface SceneMapPlacementRow { layoutId: string; objectId: string }


export function buildSceneMap(input: {
  layouts: SceneMapLayoutRow[]; transitions: SceneMapTransitionRow[]; specs: SceneMapSpecRow[];
  targets: SceneMapTargetRow[]; placements: SceneMapPlacementRow[];
}): SceneMap {
  const layoutById = new Map(input.layouts.map((l) => [l.id, l]));
  const specById = new Map(input.specs.map((s) => [s.id, s]));
  const layoutsByObject = new Map<string, Set<string>>();
  for (const p of input.placements) {
    if (!layoutById.has(p.layoutId)) continue;
    const set = layoutsByObject.get(p.objectId) ?? new Set<string>();
    set.add(p.layoutId);
    layoutsByObject.set(p.objectId, set);
  }
  // layoutId -> specId -> via (直接付与を優先)
  const specsByLayout = new Map<string, Map<string, SceneSpecVia>>();
  const placed = new Set<string>();
  const attach = (layoutId: string, specId: string, via: SceneSpecVia): void => {
    const m = specsByLayout.get(layoutId) ?? new Map<string, SceneSpecVia>();
    if (m.get(specId) !== 'scene') m.set(specId, via);
    specsByLayout.set(layoutId, m);
    placed.add(specId);
  };
  for (const t of input.targets) {
    if (!specById.has(t.specId)) continue;
    if (t.kind === 'layout' && layoutById.has(t.refId)) attach(t.refId, t.specId, 'scene');
    if (t.kind === 'object') for (const lid of layoutsByObject.get(t.refId) ?? []) attach(lid, t.specId, 'actor');
  }
  const sortedTransitions = [...input.transitions].sort((a, b) => a.ordinal - b.ordinal);
  const scenes = [...input.layouts]
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, 'ja'))
    .map((l): SceneMapScene => {
      const specs = [...(specsByLayout.get(l.id) ?? new Map<string, SceneSpecVia>())]
        .map(([sid, via]) => ({ ...specById.get(sid)!, via }))
        .sort((a, b) => a.code.localeCompare(b.code, 'ja'));
      const outgoing = sortedTransitions
        .filter((t) => t.fromLayoutId === l.id && layoutById.has(t.toLayoutId))
        .map((t) => ({ id: t.id, toLayoutId: t.toLayoutId, toName: layoutById.get(t.toLayoutId)!.name, trigger: t.trigger, condition: t.condition, label: t.label }));
      const incomingCount = sortedTransitions.filter((t) => t.toLayoutId === l.id && layoutById.has(t.fromLayoutId)).length;
      return { id: l.id, name: l.name, description: l.description, kind: l.kind, isDefault: l.isDefault, imported: !!l.anatomiaSceneId, specs, outgoing, incomingCount };
    });
  const unplacedSpecs = input.specs.filter((s) => !placed.has(s.id)).sort((a, b) => a.code.localeCompare(b.code, 'ja'));
  return { scenes, unplacedSpecs };
}
