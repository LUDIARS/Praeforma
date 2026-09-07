-- Praeforma 006 — UX scenarios and core-domain boundary review
-- Screens remain visual artifacts. Domain candidates are attached only to use-case analyses.

CREATE TABLE IF NOT EXISTS ux_scenarios (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  name text NOT NULL,
  actor text NOT NULL,
  context text NOT NULL DEFAULT '',
  goal text NOT NULL,
  success_outcome text NOT NULL,
  source_project_key text,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed')),
  revision integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ux_scenarios_project_name ON ux_scenarios(project_id, name);
CREATE INDEX IF NOT EXISTS idx_ux_scenarios_project ON ux_scenarios(project_id, updated_at);

CREATE TABLE IF NOT EXISTS ux_use_cases (
  id text PRIMARY KEY,
  scenario_id text NOT NULL REFERENCES ux_scenarios(id) ON DELETE CASCADE,
  title text NOT NULL,
  user_intent text NOT NULL,
  trigger text NOT NULL,
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_outcome text NOT NULL,
  failure_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  interruption_recovery text NOT NULL DEFAULT '',
  ordinal integer NOT NULL DEFAULT 0,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ux_use_cases_scenario ON ux_use_cases(scenario_id, ordinal);

CREATE TABLE IF NOT EXISTS ux_canvases (
  scenario_id text PRIMARY KEY REFERENCES ux_scenarios(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1,
  frames jsonb NOT NULL DEFAULT '[]'::jsonb,
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  transitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_image_analysis_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ux_analysis_runs (
  id text PRIMARY KEY,
  scenario_id text NOT NULL REFERENCES ux_scenarios(id) ON DELETE CASCADE,
  scenario_revision integer NOT NULL,
  use_case_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  use_case_revisions jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  visibility text NOT NULL DEFAULT 'sensitive' CHECK (visibility IN ('public', 'sensitive')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  anatomia_source_revision text,
  genius_query jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ux_analysis_runs_scenario ON ux_analysis_runs(scenario_id, created_at);

CREATE TABLE IF NOT EXISTS ux_boundary_proposals (
  id text PRIMARY KEY,
  analysis_id text NOT NULL REFERENCES ux_analysis_runs(id) ON DELETE CASCADE,
  scenario_id text NOT NULL REFERENCES ux_scenarios(id) ON DELETE CASCADE,
  use_case_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  name text NOT NULL,
  purpose text NOT NULL,
  classification text NOT NULL CHECK (classification IN ('core', 'supporting', 'generic')),
  responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  in_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  out_of_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  collaborations jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  unresolved_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence integer NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  rationale text NOT NULL,
  existing_domain_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  genius_assessments jsonb NOT NULL DEFAULT '[]'::jsonb,
  human_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'externalized')),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ux_boundary_proposals_scenario ON ux_boundary_proposals(scenario_id, created_at);

CREATE TABLE IF NOT EXISTS ux_boundary_decisions (
  id text PRIMARY KEY,
  scenario_id text NOT NULL REFERENCES ux_scenarios(id) ON DELETE CASCADE,
  proposal_id text NOT NULL REFERENCES ux_boundary_proposals(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('accept', 'reject', 'revise', 'split', 'merge')),
  proposal_revision integer NOT NULL,
  rationale text NOT NULL,
  result_boundaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by text NOT NULL,
  genius_publish_status text NOT NULL DEFAULT 'not_requested'
    CHECK (genius_publish_status IN ('not_requested', 'publishing', 'published', 'failed')),
  genius_card_id text,
  genius_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ux_boundary_decisions_proposal ON ux_boundary_decisions(proposal_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ux_boundary_decisions_proposal_revision
  ON ux_boundary_decisions(proposal_id, proposal_revision);

CREATE TABLE IF NOT EXISTS ux_evidence (
  id text PRIMARY KEY,
  scenario_id text NOT NULL REFERENCES ux_scenarios(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('scenario', 'use_case', 'proposal')),
  target_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('implementation', 'test', 'anatomia', 'manual')),
  source_project_key text NOT NULL,
  source_revision text NOT NULL,
  source_ref text NOT NULL,
  status text NOT NULL,
  scenario_revision integer NOT NULL,
  use_case_revision integer,
  canvas_revision integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ux_evidence_provenance
  ON ux_evidence(scenario_id, target_kind, target_id, kind, source_project_key, source_revision, source_ref);
CREATE INDEX IF NOT EXISTS idx_ux_evidence_scenario ON ux_evidence(scenario_id, recorded_at);

CREATE TABLE IF NOT EXISTS ux_image_analyses (
  id text PRIMARY KEY,
  scenario_id text NOT NULL REFERENCES ux_scenarios(id) ON DELETE CASCADE,
  base_canvas_revision integer NOT NULL,
  image_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ux_image_analyses_scenario ON ux_image_analyses(scenario_id, created_at);
