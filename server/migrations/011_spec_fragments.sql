-- Deferred planning input. Approval and reconstruction state are separate concepts.
CREATE TABLE IF NOT EXISTS spec_fragments (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  content text NOT NULL,
  source text NOT NULL,
  source_event_id text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  implementation_state text NOT NULL DEFAULT 'unimplemented'
    CHECK (implementation_state IN ('unverified', 'unimplemented', 'implemented')),
  implementation_evidence text NOT NULL DEFAULT '',
  implementation_updated_by text,
  implementation_updated_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_fragments_event ON spec_fragments(project_id, source, source_event_id);
CREATE INDEX IF NOT EXISTS idx_spec_fragments_project ON spec_fragments(project_id, created_at);
