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
  /** 遷移図キャンバスに保存した位置。未保存なら null (画面側で自動配置する、PF-MAP-11)。 */
  position: ScenePosition | null;
  /** シーンエディタに取り込んだキャプチャがあるか (PF-MAP-7)。 */
  hasCapture: boolean;
}
export interface ScenePosition { x: number; y: number }
export interface SceneMap { scenes: SceneMapScene[]; unplacedSpecs: SceneMapSpecSummary[]; canEdit: boolean }

export type FragmentCounts = { pending: number; integrated: number; rejected: number };
