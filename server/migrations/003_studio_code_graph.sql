-- Praeforma 003 — 要件定義モード (Studio) のための code graph + scene target
-- spec/schema/code-graph.md + spec/studio.md
--
-- 「ドメイン/シーンの要件定義を LLM 補助で具体化 → MUSA(Thaleia) 経由で Anatomia に
--  リレーして関連処理グラフを取得・保存する」 ための器。
--  既存 specs / spec_acceptance を要件 / 回帰テストとして再利用し、 ここでは
--  (1) spec_targets が scene(=layout) を指せるよう CHECK を広げ、
--  (2) Anatomia 由来のコードグラフ (nodes/edges) + リレー実行ログ (runs) を足す。

-- ─── (1) spec_targets が layout(=scene) を target にできるよう CHECK 拡張 ──────
-- 001 の無名 CHECK は PG 既定名 spec_targets_kind_check。 DROP IF EXISTS で安全に外す。
ALTER TABLE spec_targets DROP CONSTRAINT IF EXISTS spec_targets_kind_check;
ALTER TABLE spec_targets ADD CONSTRAINT spec_targets_kind_check
  CHECK (kind IN ('object','domain','project','layout'));

-- ─── (2-a) code_graph_nodes — Anatomia 由来のグラフノード ─────────────────────
-- target_kind/target_id = この要件束の対象 (domain or layout=scene)。
-- node_key = Anatomia が返す安定キー (symbol path 等)。 (project,target,node_key) で upsert。
CREATE TABLE IF NOT EXISTS code_graph_nodes (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES projects(id),
  target_kind   text NOT NULL,
  target_id     text NOT NULL,
  node_key      text NOT NULL,
  label         text NOT NULL,
  node_type     text NOT NULL DEFAULT 'symbol',
  anatomia_ref  jsonb NOT NULL DEFAULT '{}'::jsonb,
  source        text NOT NULL DEFAULT 'anatomia',
  status        text NOT NULL DEFAULT 'linked',
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (target_kind IN ('domain','layout')),
  CHECK (node_type IN ('symbol','file','domain','spec','external')),
  CHECK (source IN ('anatomia','manual')),
  CHECK (status IN ('linked','candidate','dismissed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_code_graph_nodes_target_key
  ON code_graph_nodes(project_id, target_kind, target_id, node_key);
CREATE INDEX IF NOT EXISTS idx_code_graph_nodes_target
  ON code_graph_nodes(project_id, target_kind, target_id);

-- ─── (2-b) code_graph_edges — ノード間の関係 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS code_graph_edges (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES projects(id),
  target_kind   text NOT NULL,
  target_id     text NOT NULL,
  from_node     text NOT NULL REFERENCES code_graph_nodes(id),
  to_node       text NOT NULL REFERENCES code_graph_nodes(id),
  relation      text NOT NULL DEFAULT 'related',
  source        text NOT NULL DEFAULT 'anatomia',
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (target_kind IN ('domain','layout')),
  CHECK (relation IN ('calls','depends','implements','related')),
  CHECK (source IN ('anatomia','manual'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_code_graph_edges_triple
  ON code_graph_edges(from_node, to_node, relation);
CREATE INDEX IF NOT EXISTS idx_code_graph_edges_target
  ON code_graph_edges(project_id, target_kind, target_id);

-- ─── (2-c) code_graph_runs — MUSA(Thaleia)→Anatomia リレー 1 回 = 1 run ───────
-- 企画↔実装トレーサビリティ (Thaleia の役割) のため、 いつ・どの要件束で・何を
-- 引いたかを残す。
CREATE TABLE IF NOT EXISTS code_graph_runs (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES projects(id),
  target_kind   text NOT NULL,
  target_id     text NOT NULL,
  query         text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'ok',
  node_count    integer NOT NULL DEFAULT 0,
  edge_count    integer NOT NULL DEFAULT 0,
  summary       text,
  raw           jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (target_kind IN ('domain','layout')),
  CHECK (status IN ('ok','error','musa_unconfigured'))
);
CREATE INDEX IF NOT EXISTS idx_code_graph_runs_target
  ON code_graph_runs(project_id, target_kind, target_id, created_at);
