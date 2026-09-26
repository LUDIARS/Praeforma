-- UX の構成変更 (spec/feature/project-ux-goal.md PF-GOAL-W4 / spec/feature/project-constraints.md)。
-- ターゲットユーザーの欄と、プロジェクトの制約を足す。追加のみで、既存プロジェクトの文章は変えない。
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_target TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS project_constraints (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  kind text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_constraints_project ON project_constraints(project_id);
