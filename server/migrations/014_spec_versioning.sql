CREATE TABLE IF NOT EXISTS spec_version_heads(project_id TEXT PRIMARY KEY REFERENCES projects(id), major INTEGER NOT NULL DEFAULT 0, minor INTEGER NOT NULL DEFAULT 0, patch INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, suppress INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS spec_version_logs(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), version TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, payload JSONB NOT NULL, created_at TEXT NOT NULL, UNIQUE(project_id,version));
CREATE TABLE IF NOT EXISTS spec_reconstructions(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), payload JSONB NOT NULL, confirmed_version TEXT);
CREATE TABLE IF NOT EXISTS spec_reconstruction_fragments(fragment_id TEXT PRIMARY KEY REFERENCES spec_fragments(id), reconstruction_id TEXT NOT NULL REFERENCES spec_reconstructions(id));
CREATE OR REPLACE FUNCTION record_spec_addition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h spec_version_heads; detail JSONB;
BEGIN
  INSERT INTO spec_version_heads(project_id) VALUES(NEW.project_id) ON CONFLICT DO NOTHING;
  UPDATE spec_version_heads SET patch=patch+1,revision=revision+1 WHERE project_id=NEW.project_id AND suppress=0 RETURNING * INTO h;
  IF FOUND THEN
    detail := to_jsonb(NEW);
    INSERT INTO spec_version_logs(id,project_id,version,revision,kind,payload,created_at) VALUES(md5(random()::text||clock_timestamp()::text),NEW.project_id,h.major||'.'||h.minor||'.'||h.patch,h.revision,CASE WHEN TG_TABLE_NAME='specs' THEN 'spec-added' ELSE 'fragment-added' END,jsonb_build_object('id',NEW.id,'after',detail),to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='specs_version_added') THEN CREATE TRIGGER specs_version_added AFTER INSERT ON specs FOR EACH ROW EXECUTE FUNCTION record_spec_addition(); END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='spec_fragments_version_added') THEN CREATE TRIGGER spec_fragments_version_added AFTER INSERT ON spec_fragments FOR EACH ROW EXECUTE FUNCTION record_spec_addition(); END IF;
END $$;
