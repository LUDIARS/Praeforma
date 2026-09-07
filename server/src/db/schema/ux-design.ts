// UX scenarios, use cases, boundary review, canvas, and evidence.
//
// A screen/frame never owns a domain reference. Core-domain candidates attach to
// a use-case analysis so visual structure cannot accidentally become a domain boundary.

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { LOCAL_MODE } from '../mode.ts';
import { projects } from './project.ts';
import {
  uxScenarios as uxScenariosSqlite,
  uxUseCases as uxUseCasesSqlite,
  uxCanvases as uxCanvasesSqlite,
  uxAnalysisRuns as uxAnalysisRunsSqlite,
  uxBoundaryProposals as uxBoundaryProposalsSqlite,
  uxBoundaryDecisions as uxBoundaryDecisionsSqlite,
  uxEvidence as uxEvidenceSqlite,
  uxImageAnalyses as uxImageAnalysesSqlite,
} from '../sqlite-schema.ts';

export type ScenarioStatus = 'draft' | 'reviewed';
export type DomainClassification = 'core' | 'supporting' | 'generic';
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'externalized';
export type BoundaryDecisionAction = 'accept' | 'reject' | 'revise' | 'split' | 'merge';
export type AnalysisStatus = 'running' | 'completed' | 'error';
export type GeniusPublishStatus = 'not_requested' | 'publishing' | 'published' | 'failed';

export interface CanvasFrame {
  id: string;
  name: string;
  description: string;
  states: Array<{ id: string; name: string; condition: string; content: string }>;
  x: number;
  y: number;
  width: number;
  height: number;
  viewport: { width: number; height: number };
}

export interface CanvasElement {
  id: string;
  frame_id: string;
  kind: 'box' | 'text' | 'button' | 'input' | 'image' | 'list';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sample_text: string | null;
  dynamic: { enabled: boolean; source: string | null; update_condition: string | null } | null;
  follow: { target_element_id: string; condition: string } | null;
}

export interface CanvasTransition {
  id: string;
  from: { frame_id: string; element_id: string | null };
  to_frame_id: string;
  trigger: string;
  label: string;
}

export interface BoundarySnapshot {
  name: string;
  responsibility: string;
  classification: DomainClassification;
  in_scope: string[];
  out_of_scope: string[];
  rules: string[];
  ubiquitous_language: string[];
  interactions: string[];
  use_case_ids: string[];
}

const uxScenariosPg = pgTable(
  'ux_scenarios',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id),
    name: text('name').notNull(),
    actor: text('actor').notNull(),
    context: text('context').notNull().default(''),
    goal: text('goal').notNull(),
    successOutcome: text('success_outcome').notNull(),
    sourceProjectKey: text('source_project_key'),
    sourceRefs: jsonb('source_refs').$type<string[]>().notNull().default([]),
    status: text('status').$type<ScenarioStatus>().notNull().default('draft'),
    revision: integer('revision').notNull().default(1),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqProjectName: uniqueIndex('uq_ux_scenarios_project_name').on(t.projectId, t.name),
    idxProject: index('idx_ux_scenarios_project').on(t.projectId, t.updatedAt),
  }),
);

const uxUseCasesPg = pgTable(
  'ux_use_cases',
  {
    id: text('id').primaryKey(),
    scenarioId: text('scenario_id').notNull().references(() => uxScenariosPg.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    userIntent: text('user_intent').notNull(),
    trigger: text('trigger').notNull(),
    preconditions: jsonb('preconditions').$type<string[]>().notNull().default([]),
    successOutcome: text('success_outcome').notNull(),
    failureOutcomes: jsonb('failure_outcomes').$type<string[]>().notNull().default([]),
    interruptionRecovery: text('interruption_recovery').notNull().default(''),
    ordinal: integer('ordinal').notNull().default(0),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ idxScenario: index('idx_ux_use_cases_scenario').on(t.scenarioId, t.ordinal) }),
);

const uxCanvasesPg = pgTable('ux_canvases', {
  scenarioId: text('scenario_id').primaryKey().references(() => uxScenariosPg.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull().default(1),
  frames: jsonb('frames').$type<CanvasFrame[]>().notNull().default([]),
  elements: jsonb('elements').$type<CanvasElement[]>().notNull().default([]),
  transitions: jsonb('transitions').$type<CanvasTransition[]>().notNull().default([]),
  appliedImageAnalysisIds: jsonb('applied_image_analysis_ids').$type<string[]>().notNull().default([]),
  updatedBy: text('updated_by').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const uxAnalysisRunsPg = pgTable(
  'ux_analysis_runs',
  {
    id: text('id').primaryKey(),
    scenarioId: text('scenario_id').notNull().references(() => uxScenariosPg.id, { onDelete: 'cascade' }),
    scenarioRevision: integer('scenario_revision').notNull(),
    useCaseIds: jsonb('use_case_ids').$type<string[]>().notNull().default([]),
    useCaseRevisions: jsonb('use_case_revisions').$type<Record<string, number>>().notNull().default({}),
    note: text('note'),
    visibility: text('visibility').notNull().default('sensitive'),
    status: text('status').$type<AnalysisStatus>().notNull().default('running'),
    anatomiaSourceRevision: text('anatomia_source_revision'),
    geniusQuery: jsonb('genius_query').$type<Record<string, unknown>>().notNull().default({}),
    errorCode: text('error_code'),
    requestedBy: text('requested_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({ idxScenario: index('idx_ux_analysis_runs_scenario').on(t.scenarioId, t.createdAt) }),
);

const uxBoundaryProposalsPg = pgTable(
  'ux_boundary_proposals',
  {
    id: text('id').primaryKey(),
    analysisId: text('analysis_id').notNull().references(() => uxAnalysisRunsPg.id, { onDelete: 'cascade' }),
    scenarioId: text('scenario_id').notNull().references(() => uxScenariosPg.id, { onDelete: 'cascade' }),
    useCaseIds: jsonb('use_case_ids').$type<string[]>().notNull().default([]),
    name: text('name').notNull(),
    purpose: text('purpose').notNull(),
    classification: text('classification').$type<DomainClassification>().notNull(),
    responsibilities: jsonb('responsibilities').$type<string[]>().notNull().default([]),
    businessRules: jsonb('business_rules').$type<string[]>().notNull().default([]),
    inScope: jsonb('in_scope').$type<string[]>().notNull().default([]),
    outOfScope: jsonb('out_of_scope').$type<string[]>().notNull().default([]),
    collaborations: jsonb('collaborations').$type<string[]>().notNull().default([]),
    assumptions: jsonb('assumptions').$type<string[]>().notNull().default([]),
    unresolvedQuestions: jsonb('unresolved_questions').$type<string[]>().notNull().default([]),
    alternatives: jsonb('alternatives').$type<string[]>().notNull().default([]),
    confidence: integer('confidence').notNull(),
    rationale: text('rationale').notNull(),
    existingDomainRefs: jsonb('existing_domain_refs').$type<string[]>().notNull().default([]),
    geniusAssessments: jsonb('genius_assessments').$type<Array<{
      card_id: string;
      applicability: 'applicable' | 'not_applicable' | 'uncertain';
      rationale: string;
    }>>().notNull().default([]),
    humanQuestions: jsonb('human_questions').$type<string[]>().notNull().default([]),
    status: text('status').$type<ProposalStatus>().notNull().default('pending'),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ idxScenario: index('idx_ux_boundary_proposals_scenario').on(t.scenarioId, t.createdAt) }),
);

const uxBoundaryDecisionsPg = pgTable(
  'ux_boundary_decisions',
  {
    id: text('id').primaryKey(),
    scenarioId: text('scenario_id').notNull().references(() => uxScenariosPg.id, { onDelete: 'cascade' }),
    proposalId: text('proposal_id').notNull().references(() => uxBoundaryProposalsPg.id, { onDelete: 'cascade' }),
    action: text('action').$type<BoundaryDecisionAction>().notNull(),
    proposalRevision: integer('proposal_revision').notNull(),
    rationale: text('rationale').notNull(),
    resultBoundaries: jsonb('result_boundaries').$type<BoundarySnapshot[]>().notNull().default([]),
    decidedBy: text('decided_by').notNull(),
    geniusPublishStatus: text('genius_publish_status').$type<GeniusPublishStatus>().notNull().default('not_requested'),
    geniusCardId: text('genius_card_id'),
    geniusError: text('genius_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqProposalRevision: uniqueIndex('uq_ux_boundary_decisions_proposal_revision').on(t.proposalId, t.proposalRevision),
    idxProposal: index('idx_ux_boundary_decisions_proposal').on(t.proposalId, t.createdAt),
  }),
);

const uxEvidencePg = pgTable(
  'ux_evidence',
  {
    id: text('id').primaryKey(),
    scenarioId: text('scenario_id').notNull().references(() => uxScenariosPg.id, { onDelete: 'cascade' }),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    kind: text('kind').notNull(),
    sourceProjectKey: text('source_project_key').notNull(),
    sourceRevision: text('source_revision').notNull(),
    sourceRef: text('source_ref').notNull(),
    status: text('status').notNull(),
    scenarioRevision: integer('scenario_revision').notNull(),
    useCaseRevision: integer('use_case_revision'),
    canvasRevision: integer('canvas_revision'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    recordedBy: text('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqProvenance: uniqueIndex('uq_ux_evidence_provenance').on(
      t.scenarioId,
      t.targetKind,
      t.targetId,
      t.kind,
      t.sourceProjectKey,
      t.sourceRevision,
      t.sourceRef,
    ),
    idxScenario: index('idx_ux_evidence_scenario').on(t.scenarioId, t.recordedAt),
  }),
);

const uxImageAnalysesPg = pgTable(
  'ux_image_analyses',
  {
    id: text('id').primaryKey(),
    scenarioId: text('scenario_id').notNull().references(() => uxScenariosPg.id, { onDelete: 'cascade' }),
    baseCanvasRevision: integer('base_canvas_revision').notNull(),
    imageFingerprint: text('image_fingerprint').notNull(),
    status: text('status').$type<AnalysisStatus>().notNull().default('running'),
    candidates: jsonb('candidates').$type<Record<string, unknown>[]>().notNull().default([]),
    errorCode: text('error_code'),
    requestedBy: text('requested_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({ idxScenario: index('idx_ux_image_analyses_scenario').on(t.scenarioId, t.createdAt) }),
);

export const uxScenarios = LOCAL_MODE ? (uxScenariosSqlite as unknown as typeof uxScenariosPg) : uxScenariosPg;
export const uxUseCases = LOCAL_MODE ? (uxUseCasesSqlite as unknown as typeof uxUseCasesPg) : uxUseCasesPg;
export const uxCanvases = LOCAL_MODE ? (uxCanvasesSqlite as unknown as typeof uxCanvasesPg) : uxCanvasesPg;
export const uxAnalysisRuns = LOCAL_MODE ? (uxAnalysisRunsSqlite as unknown as typeof uxAnalysisRunsPg) : uxAnalysisRunsPg;
export const uxBoundaryProposals = LOCAL_MODE ? (uxBoundaryProposalsSqlite as unknown as typeof uxBoundaryProposalsPg) : uxBoundaryProposalsPg;
export const uxBoundaryDecisions = LOCAL_MODE ? (uxBoundaryDecisionsSqlite as unknown as typeof uxBoundaryDecisionsPg) : uxBoundaryDecisionsPg;
export const uxEvidence = LOCAL_MODE ? (uxEvidenceSqlite as unknown as typeof uxEvidencePg) : uxEvidencePg;
export const uxImageAnalyses = LOCAL_MODE ? (uxImageAnalysesSqlite as unknown as typeof uxImageAnalysesPg) : uxImageAnalysesPg;
