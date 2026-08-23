-- Praeforma 004 — Screen Flow (UI 仮置き → 遷移図 + 仕様書、 LLM 会話、 Cc 接続)
-- spec/data/schema/screen-flow.md + spec/feature/screen-flow.md
--
--  (1) domains.anatomia_domain / projects.anatomia_repo (Anatomia 正本への射影)
--  (2) spec_targets / code_graph_* の CHECK に 'transition' を追加
--  (3) transitions / spec_conversations / spec_messages / cc_links を新設

-- ─── (1) Anatomia 射影列 ─────────────────────────────────────────────────────
ALTER TABLE domains  ADD COLUMN IF NOT EXISTS anatomia_domain text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS anatomia_repo   text;

-- ─── (2) CHECK 拡張 (003 の無名 CHECK は PG 既定名 <table>_<col>_check) ─────
ALTER TABLE spec_targets DROP CONSTRAINT IF EXISTS spec_targets_kind_check;
ALTER TABLE spec_targets ADD CONSTRAINT spec_targets_kind_check
  CHECK (kind IN ('object','domain','project','layout','transition'));

ALTER TABLE code_graph_nodes DROP CONSTRAINT IF EXISTS code_graph_nodes_target_kind_check;
ALTER TABLE code_graph_nodes ADD CONSTRAINT code_graph_nodes_target_kind_check
  CHECK (target_kind IN ('domain','layout','transition'));
ALTER TABLE code_graph_edges DROP CONSTRAINT IF EXISTS code_graph_edges_target_kind_check;
ALTER TABLE code_graph_edges ADD CONSTRAINT code_graph_edges_target_kind_check
  CHECK (target_kind IN ('domain','layout','transition'));
ALTER TABLE code_graph_runs DROP CONSTRAINT IF EXISTS code_graph_runs_target_kind_check;
ALTER TABLE code_graph_runs ADD CONSTRAINT code_graph_runs_target_kind_check
  CHECK (target_kind IN ('domain','layout','transition'));

-- ─── (3-a) transitions — UI 要素起点の画面遷移 ─────────────────────────────
CREATE TABLE IF NOT EXISTS transitions (
  id                text PRIMARY KEY,
  project_id        text NOT NULL REFERENCES projects(id),
  from_layout_id    text NOT NULL REFERENCES layouts(id),
  source_object_id  text REFERENCES layout_objects(id) ON DELETE CASCADE,
  to_layout_id      text NOT NULL REFERENCES layouts(id),
  trigger           text NOT NULL DEFAULT 'tap',
  condition         text NOT NULL DEFAULT '',
  label             text,
  ordinal           integer NOT NULL DEFAULT 0,
  version           integer NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transitions_source_condition
  ON transitions(source_object_id, condition) WHERE source_object_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transitions_layout_trigger_condition
  ON transitions(from_layout_id, trigger, condition) WHERE source_object_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_transitions_project ON transitions(project_id);
CREATE INDEX IF NOT EXISTS idx_transitions_from    ON transitions(from_layout_id);
CREATE INDEX IF NOT EXISTS idx_transitions_to      ON transitions(to_layout_id);

-- ─── (3-b) spec_conversations / spec_messages — LLM トークエリア ────────────
CREATE TABLE IF NOT EXISTS spec_conversations (
  id           text PRIMARY KEY,
  project_id   text NOT NULL REFERENCES projects(id),
  target_kind  text NOT NULL,
  target_id    text NOT NULL,
  title        text,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (target_kind IN ('project','domain','layout','object','transition'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_conversations_target
  ON spec_conversations(project_id, target_kind, target_id);

CREATE TABLE IF NOT EXISTS spec_messages (
  id               text PRIMARY KEY,
  conversation_id  text NOT NULL REFERENCES spec_conversations(id) ON DELETE CASCADE,
  role             text NOT NULL,
  content          text NOT NULL,
  proposals        jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (role IN ('user','assistant','system'))
);
CREATE INDEX IF NOT EXISTS idx_spec_messages_conversation ON spec_messages(conversation_id, created_at);

-- ─── (3-c) cc_links — Concordia 接続記録 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_links (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  target_kind     text NOT NULL,
  target_id       text NOT NULL,
  cc_kind         text NOT NULL,
  cc_id           text NOT NULL,
  status          text NOT NULL DEFAULT 'queued',
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (target_kind IN ('spec','layout','transition')),
  CHECK (cc_kind IN ('delegation_run','taskflow_task')),
  CHECK (status IN ('queued','running','done','failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_links_cc ON cc_links(project_id, cc_kind, cc_id);
CREATE INDEX IF NOT EXISTS idx_cc_links_target ON cc_links(project_id, target_kind, target_id);
