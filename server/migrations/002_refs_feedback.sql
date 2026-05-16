-- Praeforma 002 — references + object_feedback + feedback_comments
-- spec/schema/reference.md + spec/schema/feedback.md

-- ─── references ─────────────────────────────────────────────────────────────

-- `references` は SQL 予約語なので external_references にする (spec の言葉は references のまま)
CREATE TABLE IF NOT EXISTS external_references (
  id              text PRIMARY KEY,
  project_id      text NOT NULL REFERENCES projects(id),
  target_kind     text NOT NULL,
  target_id       text NOT NULL,
  kind            text NOT NULL DEFAULT 'web',
  url             text NOT NULL,
  title           text NOT NULL,
  description     text,
  display_mode    text NOT NULL DEFAULT 'link',
  ordinal         integer NOT NULL DEFAULT 0,
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (target_kind IN ('domain','project','object','spec')),
  CHECK (kind IN ('notion','confluence','google-docs','google-sheet','web','figma','github')),
  CHECK (display_mode IN ('link','webview','markdown'))
);
CREATE INDEX IF NOT EXISTS idx_external_references_target ON external_references(target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_external_references_project ON external_references(project_id);

-- ─── object_feedback (Melpomene 互換) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS object_feedback (
  id                    text PRIMARY KEY,
  project_id            text NOT NULL REFERENCES projects(id),
  layout_id             text REFERENCES layouts(id),
  object_id             text REFERENCES objects(id),
  layout_object_id      text REFERENCES layout_objects(id),
  scene_path            text,
  world_position        jsonb,
  screen_position       jsonb,
  title                 text NOT NULL,
  body                  text,
  priority              text NOT NULL DEFAULT 'medium',
  category              text NOT NULL DEFAULT 'question',
  state                 text NOT NULL DEFAULT 'open',
  labels                jsonb NOT NULL DEFAULT '[]'::jsonb,
  assignee_user_id      text,
  github_issue_number   text,
  created_by            text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz,
  CHECK (priority IN ('low','medium','high','critical')),
  CHECK (category IN ('bug','feature','improvement','question','spec-clarification')),
  CHECK (state IN ('open','in-progress','resolved','wont-fix'))
);
CREATE INDEX IF NOT EXISTS idx_object_feedback_project ON object_feedback(project_id, state);
CREATE INDEX IF NOT EXISTS idx_object_feedback_layout ON object_feedback(layout_id, state);
CREATE INDEX IF NOT EXISTS idx_object_feedback_object ON object_feedback(object_id);
CREATE INDEX IF NOT EXISTS idx_object_feedback_layout_object ON object_feedback(layout_object_id);

-- ─── feedback_comments ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feedback_comments (
  id              text PRIMARY KEY,
  feedback_id     text NOT NULL REFERENCES object_feedback(id),
  user_id         text NOT NULL,
  display_name    text,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback
  ON feedback_comments(feedback_id, created_at);
