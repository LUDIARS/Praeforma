/** PF-RECON-3: insertion and its patch log cannot commit separately. */
export const SPEC_VERSION_DDL=[
  `CREATE TABLE IF NOT EXISTS spec_version_heads(project_id TEXT PRIMARY KEY REFERENCES projects(id), major INTEGER NOT NULL DEFAULT 0, minor INTEGER NOT NULL DEFAULT 0, patch INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, suppress INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS spec_version_logs(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), version TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(project_id,version))`,
  `CREATE TABLE IF NOT EXISTS spec_reconstructions(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL, confirmed_version TEXT)`,
  `CREATE TABLE IF NOT EXISTS spec_reconstruction_fragments(fragment_id TEXT PRIMARY KEY REFERENCES spec_fragments(id), reconstruction_id TEXT NOT NULL REFERENCES spec_reconstructions(id))`,
  ...(['spec_fragments','specs'] as const).map(table=>`CREATE TRIGGER IF NOT EXISTS ${table}_version_added AFTER INSERT ON ${table}
    BEGIN
      INSERT INTO spec_version_heads(project_id) VALUES(NEW.project_id) ON CONFLICT DO NOTHING;
      UPDATE spec_version_heads SET patch=patch+1,revision=revision+1 WHERE project_id=NEW.project_id AND suppress=0;
      INSERT INTO spec_version_logs(id,project_id,version,revision,kind,payload,created_at)
      SELECT lower(hex(randomblob(16))),project_id,major||'.'||minor||'.'||patch,revision,'${table==='specs'?'spec-added':'fragment-added'}',
      ${table==='specs'?"json_object('id',NEW.id,'after',json_object('title',NEW.title,'description',NEW.description,'code',NEW.code,'priority',NEW.priority,'category',NEW.category,'preconditions',json(NEW.preconditions),'postconditions',json(NEW.postconditions)))":"json_object('id',NEW.id,'after',json_object('content',NEW.content,'source',NEW.source))"},strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM spec_version_heads WHERE project_id=NEW.project_id AND suppress=0;
    END`),
];
