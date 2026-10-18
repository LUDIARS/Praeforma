-- Fragment sprints: a check unit for deferred planning (spec/schema/spec-sprints.md).
CREATE TABLE IF NOT EXISTS spec_sprints (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  title text NOT NULL,
  goal text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spec_sprints_project ON spec_sprints(project_id, id);
CREATE TABLE IF NOT EXISTS spec_sprint_fragments (
  fragment_id text PRIMARY KEY REFERENCES spec_fragments(id),
  sprint_id text NOT NULL REFERENCES spec_sprints(id),
  added_by text NOT NULL,
  added_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spec_sprint_fragments_sprint ON spec_sprint_fragments(sprint_id);
