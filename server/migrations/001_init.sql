-- Praeforma 001_init — 全テーブル + index を一括 init。
-- Cernere AIFormat の冪等ルール準拠 (CREATE IF NOT EXISTS / ALTER ADD COLUMN IF NOT EXISTS)。
-- DROP TABLE / DROP COLUMN / ALTER COLUMN TYPE は使わない。

-- ─── projects + project_members ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  description     text,
  org_id          text NOT NULL,
  owner_user_id   text NOT NULL,
  platforms       jsonb NOT NULL DEFAULT '["web"]'::jsonb,
  default_layout_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id);

CREATE TABLE IF NOT EXISTS project_members (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  user_id         text NOT NULL,
  role            text NOT NULL DEFAULT 'viewer',
  display_name    text,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz,
  CHECK (role IN ('owner','planner','designer','programmer','reviewer','viewer'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_members_project_user
  ON project_members(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- ─── domains ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS domains (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  name            text NOT NULL,
  description     text,
  color           text NOT NULL DEFAULT '#888888',
  icon            text,
  parent_id       text,
  max_count       integer,
  required_attrs  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_domains_project_name ON domains(project_id, name);
CREATE INDEX IF NOT EXISTS idx_domains_project ON domains(project_id);
CREATE INDEX IF NOT EXISTS idx_domains_parent ON domains(parent_id);

-- ─── objects + object_attrs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS objects (
  id                          text PRIMARY KEY,
  project_id                  text NOT NULL REFERENCES projects(id),
  domain_id                   text NOT NULL REFERENCES domains(id),
  label                       text NOT NULL,
  placeholder_shape           text NOT NULL DEFAULT 'cube',
  placeholder_color           text NOT NULL DEFAULT '#888888',
  placeholder_image_asset_id  text,
  parent_object_id            text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_objects_project ON objects(project_id);
CREATE INDEX IF NOT EXISTS idx_objects_domain ON objects(domain_id);
CREATE INDEX IF NOT EXISTS idx_objects_parent ON objects(parent_object_id);

CREATE TABLE IF NOT EXISTS object_attrs (
  id              bigserial PRIMARY KEY,
  object_id       text NOT NULL REFERENCES objects(id),
  key             text NOT NULL,
  value           jsonb NOT NULL,
  inherited_from  text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_object_attrs_object_key ON object_attrs(object_id, key);
CREATE INDEX IF NOT EXISTS idx_object_attrs_object ON object_attrs(object_id);
CREATE INDEX IF NOT EXISTS idx_object_attrs_key ON object_attrs(key);

-- ─── layouts + layout_objects + cameras ────────────────────────────────────

CREATE TABLE IF NOT EXISTS layouts (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  name            text NOT NULL,
  description     text,
  kind            text NOT NULL DEFAULT 'world-3d',
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_layouts_project ON layouts(project_id);

CREATE TABLE IF NOT EXISTS layout_objects (
  id                          text PRIMARY KEY,
  layout_id                   text NOT NULL REFERENCES layouts(id),
  object_id                   text NOT NULL REFERENCES objects(id),
  position                    jsonb NOT NULL DEFAULT '[0,0,0]'::jsonb,
  rotation                    jsonb NOT NULL DEFAULT '[0,0,0]'::jsonb,
  scale                       jsonb NOT NULL DEFAULT '[1,1,1]'::jsonb,
  parent_layout_object_id     text,
  lock_transform              boolean NOT NULL DEFAULT false,
  ordinal                     integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_layout_objects_layout_object
  ON layout_objects(layout_id, object_id);
CREATE INDEX IF NOT EXISTS idx_layout_objects_layout ON layout_objects(layout_id);
CREATE INDEX IF NOT EXISTS idx_layout_objects_object ON layout_objects(object_id);
CREATE INDEX IF NOT EXISTS idx_layout_objects_parent ON layout_objects(parent_layout_object_id);

CREATE TABLE IF NOT EXISTS cameras (
  id              text PRIMARY KEY,
  layout_id       text NOT NULL REFERENCES layouts(id),
  name            text NOT NULL DEFAULT 'main',
  kind            text NOT NULL DEFAULT 'perspective',
  position        jsonb NOT NULL DEFAULT '[0,5,-10]'::jsonb,
  target          jsonb NOT NULL DEFAULT '[0,0,0]'::jsonb,
  up              jsonb NOT NULL DEFAULT '[0,1,0]'::jsonb,
  fov             real DEFAULT 60.0,
  ortho_size      real DEFAULT 10.0,
  near            real NOT NULL DEFAULT 0.1,
  far             real NOT NULL DEFAULT 1000.0,
  is_default      boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cameras_layout_name ON cameras(layout_id, name);
CREATE INDEX IF NOT EXISTS idx_cameras_layout ON cameras(layout_id);

-- ─── specs + spec_targets + spec_acceptance ───────────────────────────────

CREATE TABLE IF NOT EXISTS specs (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  code            text NOT NULL,
  title           text NOT NULL,
  description     text,
  priority        text NOT NULL DEFAULT 'should',
  category        text NOT NULL DEFAULT 'behavior',
  preconditions   jsonb NOT NULL DEFAULT '[]'::jsonb,
  postconditions  jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'draft',
  version         integer NOT NULL DEFAULT 1,
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CHECK (priority IN ('must','should','could','wont')),
  CHECK (category IN ('behavior','appearance','data','interaction')),
  CHECK (status IN ('draft','review','approved','obsolete'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_specs_project_code ON specs(project_id, code);
CREATE INDEX IF NOT EXISTS idx_specs_project ON specs(project_id);
CREATE INDEX IF NOT EXISTS idx_specs_status ON specs(project_id, status);

CREATE TABLE IF NOT EXISTS spec_targets (
  id              bigserial PRIMARY KEY,
  spec_id         text NOT NULL REFERENCES specs(id),
  kind            text NOT NULL,
  ref_id          text NOT NULL,
  CHECK (kind IN ('object','domain','project'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_targets_spec_kind_ref
  ON spec_targets(spec_id, kind, ref_id);
CREATE INDEX IF NOT EXISTS idx_spec_targets_spec ON spec_targets(spec_id);
CREATE INDEX IF NOT EXISTS idx_spec_targets_ref ON spec_targets(kind, ref_id);

CREATE TABLE IF NOT EXISTS spec_acceptance (
  id              text PRIMARY KEY,
  spec_id         text NOT NULL REFERENCES specs(id),
  ordinal         integer NOT NULL DEFAULT 0,
  text            text NOT NULL,
  level           text NOT NULL DEFAULT 'manual',
  expression      text,
  kind            text NOT NULL DEFAULT 'positive',
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (level IN ('manual','assertion','event')),
  CHECK (kind IN ('positive','negative')),
  CHECK (level = 'manual' OR expression IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_spec_acceptance_spec ON spec_acceptance(spec_id);

-- ─── assets + object_assets ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id                text PRIMARY KEY,
  project_id        text NOT NULL REFERENCES projects(id),
  name              text NOT NULL,
  kind              text NOT NULL,
  mime_type         text,
  storage_url       text NOT NULL,
  size_bytes        bigint,
  checksum_sha256   text,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by       text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CHECK (kind IN ('image','sprite','model-3d','unity-prefab','particle','other'))
);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(project_id, kind);

CREATE TABLE IF NOT EXISTS object_assets (
  id                  bigserial PRIMARY KEY,
  object_id           text NOT NULL REFERENCES objects(id),
  platform            text NOT NULL,
  asset_id            text NOT NULL REFERENCES assets(id),
  transform_override  jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_object_assets_object_platform
  ON object_assets(object_id, platform);
CREATE INDEX IF NOT EXISTS idx_object_assets_object ON object_assets(object_id);
CREATE INDEX IF NOT EXISTS idx_object_assets_asset ON object_assets(asset_id);

-- ─── acceptance_runs + acceptance_results ──────────────────────────────────

CREATE TABLE IF NOT EXISTS acceptance_runs (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  layout_id       text NOT NULL REFERENCES layouts(id),
  platform        text NOT NULL,
  trigger         text NOT NULL DEFAULT 'manual',
  seed            text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running',
  summary         jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by    text,
  CHECK (platform IN ('web','unity','webgl','2d-web')),
  CHECK (trigger IN ('manual','file-save','cron','ci')),
  CHECK (status IN ('running','passed','failed','error','aborted'))
);
CREATE INDEX IF NOT EXISTS idx_acceptance_runs_project ON acceptance_runs(project_id, started_at);
CREATE INDEX IF NOT EXISTS idx_acceptance_runs_layout ON acceptance_runs(layout_id, started_at);

CREATE TABLE IF NOT EXISTS acceptance_results (
  id              bigserial PRIMARY KEY,
  run_id          text NOT NULL REFERENCES acceptance_runs(id),
  acceptance_id   text NOT NULL REFERENCES spec_acceptance(id),
  status          text NOT NULL,
  observed        jsonb,
  error_message   text,
  log_excerpt     text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  duration_ms     integer NOT NULL DEFAULT 0,
  CHECK (status IN ('pass','fail','skip','error'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acceptance_results_run_acceptance
  ON acceptance_results(run_id, acceptance_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_results_run ON acceptance_results(run_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_results_acceptance
  ON acceptance_results(acceptance_id, started_at);

-- ─── collab: edit_sessions + edit_ops + audit_log ──────────────────────────

CREATE TABLE IF NOT EXISTS edit_sessions (
  id                 text PRIMARY KEY,
  project_id         text NOT NULL REFERENCES projects(id),
  user_id            text NOT NULL,
  client_kind        text NOT NULL,
  cursor             jsonb,
  connected_at       timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at  timestamptz NOT NULL DEFAULT now(),
  disconnected_at    timestamptz,
  CHECK (client_kind IN ('web','unity'))
);
CREATE INDEX IF NOT EXISTS idx_edit_sessions_project_active
  ON edit_sessions(project_id) WHERE disconnected_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_edit_sessions_user ON edit_sessions(user_id);

CREATE TABLE IF NOT EXISTS edit_ops (
  id              bigserial PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  session_id      text,
  user_id         text NOT NULL,
  op              text NOT NULL,
  target_kind     text NOT NULL,
  target_id       text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_version    integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_edit_ops_project_id_desc ON edit_ops(project_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_edit_ops_target ON edit_ops(target_kind, target_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id                  bigserial PRIMARY KEY,
  project_id          text NOT NULL REFERENCES projects(id),
  actor_user_id       text NOT NULL,
  actor_display_name  text,
  action              text NOT NULL,
  target_kind         text,
  target_id           text,
  meta                jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip                  text,
  user_agent          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_project ON audit_log(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(project_id, action);
