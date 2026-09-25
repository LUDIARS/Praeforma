-- 企画概要書 (ペライチのコンセプトシート)。spec/feature/concept-sheet.md / spec/schema/concept-sheets.md。
CREATE TABLE IF NOT EXISTS concept_sheets (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  payload jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concept_sheets_project ON concept_sheets(project_id);
