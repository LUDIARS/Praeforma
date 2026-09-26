-- 企画概要書の版 (rv) と自動更新、ビジュアル素材 (spec/feature/concept-sheet.md PF-CS-10〜12 / spec/feature/project-visuals.md)。
-- 追加の表・列のみ。既存の行は消さず、既存の concept_sheets 行はその内容のまま rv1 として版へ写す。

-- ビジュアル素材: コンセプトアート / キービジュアル / スクリーンショット。画像は data URL のまま持つ (assets は仮実装のため)。
CREATE TABLE IF NOT EXISTS project_visuals (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  kind text NOT NULL,
  label text NOT NULL,
  note text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  digest text NOT NULL,
  data_url text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_project_visuals_project ON project_visuals(project_id);

-- 企画概要書の版。画像は複製せず、使ったビジュアルを visual_refs ([{visualId, digest, kind, label, note}]) で指す。
CREATE TABLE IF NOT EXISTS concept_sheet_versions (
  sheet_id text NOT NULL REFERENCES concept_sheets(id) ON DELETE CASCADE,
  rv integer NOT NULL,
  project_id text NOT NULL REFERENCES projects(id),
  payload jsonb NOT NULL,
  visual_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, rv)
);
CREATE INDEX IF NOT EXISTS idx_concept_sheet_versions_project ON concept_sheet_versions(project_id);

-- 自動更新の ON/OFF (既定は ON) と、最新版の番号。既存の行は rv1 が最新版。
ALTER TABLE concept_sheets ADD COLUMN IF NOT EXISTS auto_update boolean NOT NULL DEFAULT true;
ALTER TABLE concept_sheets ADD COLUMN IF NOT EXISTS latest_rv integer NOT NULL DEFAULT 1;

-- 既存の行を rv1 として写す。冪等: 版のある行は写さない (SQLite は起動時に同じ処理を流す)。
INSERT INTO concept_sheet_versions (sheet_id, rv, project_id, payload, visual_refs, kind, created_by, created_at)
SELECT s.id, 1, s.project_id, s.payload, '[]'::jsonb, 'migrated', 'migration:021', s.updated_at
FROM concept_sheets s
WHERE NOT EXISTS (SELECT 1 FROM concept_sheet_versions v WHERE v.sheet_id = s.id);
