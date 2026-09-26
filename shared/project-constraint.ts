// プロジェクトの制約 (spec/feature/project-constraints.md)。
// 企画・技術・運用などの縛りを 1 件ずつ持つ。企画の制約は UX を縛るものとして UX タブにも出す (PF-CON-3)。

export const CONSTRAINT_KINDS = ['planning', 'technical', 'other'] as const;
export type ConstraintKind = typeof CONSTRAINT_KINDS[number];

export const CONSTRAINT_KIND_LABELS: Record<ConstraintKind, string> = {
  planning: '企画',
  technical: '技術',
  other: '運用・その他',
};

export const CONSTRAINT_LIMITS = { title: 80, detail: 4000, perProject: 200 } as const;

export interface ProjectConstraint {
  id: string;
  kind: ConstraintKind;
  title: string;
  detail: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
