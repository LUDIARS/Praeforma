// プロジェクトの基本画面 (ダッシュボード / 遷移図) が server と web で共有する応答の型。
// spec/feature/project-dashboard.md, spec/feature/scene-map.md

export type ProjectEventKind = 'fragment' | 'systematize' | 'scene' | 'transition' | 'spec' | 'actor';
export type ProjectEventTargetKind = 'fragment' | 'spec' | 'layout' | 'transition' | 'object';
export interface ProjectEvent {
  id: string; kind: ProjectEventKind; at: string; title: string; detail: string | null;
  actor: string | null; target: { kind: ProjectEventTargetKind; id: string } | null;
}

export interface SceneMapSpecSummary { id: string; code: string; title: string; status: string; priority: string }
export type SceneSpecVia = 'scene' | 'actor';
export interface SceneMapSpec extends SceneMapSpecSummary { via: SceneSpecVia }
export interface SceneMapTransition { id: string; toLayoutId: string; toName: string; trigger: string; condition: string; label: string | null }
export interface SceneMapScene {
  id: string; name: string; description: string | null; kind: string; isDefault: boolean;
  /** Anatomia の解析から取り込んだシーンなら true。 */
  imported: boolean;
  specs: SceneMapSpec[];
  outgoing: SceneMapTransition[];
  incomingCount: number;
}
export interface SceneMap { scenes: SceneMapScene[]; unplacedSpecs: SceneMapSpecSummary[] }
