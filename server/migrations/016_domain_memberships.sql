CREATE TABLE IF NOT EXISTS domain_memberships (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  core_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  PRIMARY KEY(project_id, core_id, business_id), CHECK(core_id <> business_id)
);
