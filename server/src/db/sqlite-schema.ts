import { SPEC_VERSION_DDL } from './spec-version-sqlite.ts';
// SQLite 版スキーマ (ローカル「仕様書レビュー」モード用、 Studio 最小サブセット 15 テーブル)。
//
// 既存 pg スキーマと同じテーブル名 / カラム名 / JS キーで定義し、 各 pg schema ファイルが
// LOCAL_MODE 時にこちらを (pg 型へキャストして) 再エクスポートする。 ルートは無改変で sqlite を叩く。
//
// 型対応: jsonb → text{json} / timestamptz → integer{timestamp_ms} / bigserial →
//         integer autoincrement / boolean → integer{boolean}。
// 永続化対象外 (objects/assets 等も含めた最小集合)。 認証/個人データは持たない。

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { featureManualsSqlite, MANUAL_DDL } from './manual-sqlite.ts';
import { sceneDocumentsSqlite, SCENE_DDL } from './scene-sqlite.ts';
import type { DataDesign } from '../../../shared/data-design.ts';
import type { ImplementationState } from '../../../shared/spec-fragments.ts';

const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const now = () => new Date();

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  uxExperience: text('ux_experience').notNull().default(''),
  uxDesign: text('ux_design').notNull().default(''),
  uxGoal: text('ux_goal').notNull().default(''),
  uxGoalRevision: integer('ux_goal_revision').notNull().default(0),
  orgId: text('org_id').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  platforms: text('platforms', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => ['web']),
  defaultLayoutId: text('default_layout_id'),
  anatomiaRepo: text('anatomia_repo'),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
  deletedAt: ts('deleted_at'),
});

export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('viewer'),
  displayName: text('display_name'),
  joinedAt: ts('joined_at').notNull().$defaultFn(now),
  lastSeenAt: ts('last_seen_at'),
});

export const dataDesigns = sqliteTable('data_designs', {
  projectId: text('project_id').primaryKey().references(() => projects.id),
  definition: text('definition', { mode: 'json' }).$type<DataDesign>().notNull(),
  revision: integer('revision').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const specFragments = sqliteTable('spec_fragments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  content: text('content').notNull(),
  source: text('source').notNull(),
  sourceEventId: text('source_event_id').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  implementationState: text('implementation_state').$type<ImplementationState>().notNull().default('unimplemented'),
  implementationEvidence: text('implementation_evidence').notNull().default(''),
  implementationUpdatedBy: text('implementation_updated_by'),
  implementationUpdatedAt: ts('implementation_updated_at'),
  revision: integer('revision').notNull().default(1),
});

export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  definitionKind: text('definition_kind').$type<'core' | 'business'>(),
  definitionValue: text('definition_value').notNull().default(''),
  definitionSceneIds: text('definition_scene_ids', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  definitionRevision: integer('definition_revision').notNull().default(0),
  color: text('color').notNull().default('#888888'),
  icon: text('icon'),
  parentId: text('parent_id'),
  maxCount: integer('max_count'),
  requiredAttrs: text('required_attrs', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  anatomiaDomain: text('anatomia_domain'),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const objects = sqliteTable('objects', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  domainId: text('domain_id').notNull(),
  label: text('label').notNull(),
  description: text('description'),
  placeholderShape: text('placeholder_shape').notNull().default('cube'),
  placeholderColor: text('placeholder_color').notNull().default('#888888'),
  placeholderImageAssetId: text('placeholder_image_asset_id'),
  parentObjectId: text('parent_object_id'),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
  deletedAt: ts('deleted_at'),
});

export const objectAttrs = sqliteTable('object_attrs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  objectId: text('object_id').notNull(),
  key: text('key').notNull(),
  value: text('value', { mode: 'json' }).notNull(),
  inheritedFrom: text('inherited_from'),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  mimeType: text('mime_type'),
  storageUrl: text('storage_url').notNull(),
  sizeBytes: integer('size_bytes'),
  checksumSha256: text('checksum_sha256'),
  meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  uploadedBy: text('uploaded_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
  deletedAt: ts('deleted_at'),
});

export const objectAssets = sqliteTable('object_assets', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  objectId: text('object_id').notNull(),
  platform: text('platform').notNull(),
  assetId: text('asset_id').notNull(),
  transformOverride: text('transform_override', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const layouts = sqliteTable('layouts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  kind: text('kind').notNull().default('world-3d'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
  deletedAt: ts('deleted_at'),
});

export const layoutObjects = sqliteTable('layout_objects', {
  id: text('id').primaryKey(),
  layoutId: text('layout_id').notNull(),
  objectId: text('object_id').notNull(),
  position: text('position', { mode: 'json' }).$type<number[]>().notNull().$defaultFn(() => [0, 0, 0]),
  rotation: text('rotation', { mode: 'json' }).$type<number[]>().notNull().$defaultFn(() => [0, 0, 0]),
  scale: text('scale', { mode: 'json' }).$type<number[]>().notNull().$defaultFn(() => [1, 1, 1]),
  parentLayoutObjectId: text('parent_layout_object_id'),
  lockTransform: integer('lock_transform', { mode: 'boolean' }).notNull().default(false),
  ordinal: integer('ordinal').notNull().default(0),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const transitions = sqliteTable('transitions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  fromLayoutId: text('from_layout_id').notNull(),
  sourceObjectId: text('source_object_id'),
  toLayoutId: text('to_layout_id').notNull(),
  trigger: text('trigger').notNull().default('tap'),
  condition: text('condition').notNull().default(''),
  label: text('label'),
  ordinal: integer('ordinal').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const specConversations = sqliteTable('spec_conversations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  title: text('title'),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const specMessages = sqliteTable('spec_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  proposals: text('proposals', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  applied: integer('applied', { mode: 'boolean' }).notNull().default(false),
  createdAt: ts('created_at').notNull().$defaultFn(now),
});

export const ccLinks = sqliteTable('cc_links', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  ccKind: text('cc_kind').notNull(),
  ccId: text('cc_id').notNull(),
  status: text('status').notNull().default('queued'),
  lastSyncedAt: ts('last_synced_at'),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const specs = sqliteTable('specs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').notNull().default('should'),
  category: text('category').notNull().default('behavior'),
  preconditions: text('preconditions', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  postconditions: text('postconditions', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  status: text('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
  deletedAt: ts('deleted_at'),
});

export const specTargets = sqliteTable('spec_targets', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  specId: text('spec_id').notNull(),
  kind: text('kind').notNull(),
  refId: text('ref_id').notNull(),
});

export const specAcceptance = sqliteTable('spec_acceptance', {
  id: text('id').primaryKey(),
  specId: text('spec_id').notNull(),
  ordinal: integer('ordinal').notNull().default(0),
  text: text('text').notNull(),
  level: text('level').notNull().default('manual'),
  expression: text('expression'),
  kind: text('kind').notNull().default('positive'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const codeGraphNodes = sqliteTable('code_graph_nodes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  nodeKey: text('node_key').notNull(),
  label: text('label').notNull(),
  nodeType: text('node_type').notNull().default('symbol'),
  anatomiaRef: text('anatomia_ref', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  source: text('source').notNull().default('anatomia'),
  status: text('status').notNull().default('linked'),
  meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const codeGraphEdges = sqliteTable('code_graph_edges', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  fromNode: text('from_node').notNull(),
  toNode: text('to_node').notNull(),
  relation: text('relation').notNull().default('related'),
  source: text('source').notNull().default('anatomia'),
  meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  createdAt: ts('created_at').notNull().$defaultFn(now),
});

export const codeGraphRuns = sqliteTable('code_graph_runs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  query: text('query').notNull().default(''),
  status: text('status').notNull().default('ok'),
  nodeCount: integer('node_count').notNull().default(0),
  edgeCount: integer('edge_count').notNull().default(0),
  summary: text('summary'),
  raw: text('raw', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  requestedBy: text('requested_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
});

export const uxScenarios = sqliteTable('ux_scenarios', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  actor: text('actor').notNull(),
  context: text('context').notNull().default(''),
  goal: text('goal').notNull(),
  successOutcome: text('success_outcome').notNull(),
  sourceProjectKey: text('source_project_key'),
  sourceRefs: text('source_refs', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  status: text('status').notNull().default('draft'),
  revision: integer('revision').notNull().default(1),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const uxUseCases = sqliteTable('ux_use_cases', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull(),
  title: text('title').notNull(),
  userIntent: text('user_intent').notNull(),
  trigger: text('trigger').notNull(),
  preconditions: text('preconditions', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  successOutcome: text('success_outcome').notNull(),
  failureOutcomes: text('failure_outcomes', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  interruptionRecovery: text('interruption_recovery').notNull().default(''),
  ordinal: integer('ordinal').notNull().default(0),
  revision: integer('revision').notNull().default(1),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const uxCanvases = sqliteTable('ux_canvases', {
  scenarioId: text('scenario_id').primaryKey(),
  revision: integer('revision').notNull().default(1),
  frames: text('frames', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  elements: text('elements', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  transitions: text('transitions', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  appliedImageAnalysisIds: text('applied_image_analysis_ids', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  updatedBy: text('updated_by').notNull(),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const uxAnalysisRuns = sqliteTable('ux_analysis_runs', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull(),
  scenarioRevision: integer('scenario_revision').notNull(),
  useCaseIds: text('use_case_ids', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  useCaseRevisions: text('use_case_revisions', { mode: 'json' }).$type<Record<string, number>>().notNull().$defaultFn(() => ({})),
  note: text('note'),
  visibility: text('visibility').notNull().default('sensitive'),
  status: text('status').notNull().default('running'),
  anatomiaSourceRevision: text('anatomia_source_revision'),
  geniusQuery: text('genius_query', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  errorCode: text('error_code'),
  requestedBy: text('requested_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  completedAt: ts('completed_at'),
});

export const uxBoundaryProposals = sqliteTable('ux_boundary_proposals', {
  id: text('id').primaryKey(),
  analysisId: text('analysis_id').notNull(),
  scenarioId: text('scenario_id').notNull(),
  useCaseIds: text('use_case_ids', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  name: text('name').notNull(),
  purpose: text('purpose').notNull(),
  classification: text('classification').notNull(),
  responsibilities: text('responsibilities', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  businessRules: text('business_rules', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  inScope: text('in_scope', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  outOfScope: text('out_of_scope', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  collaborations: text('collaborations', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  assumptions: text('assumptions', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  unresolvedQuestions: text('unresolved_questions', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  alternatives: text('alternatives', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  confidence: integer('confidence').notNull(),
  rationale: text('rationale').notNull(),
  existingDomainRefs: text('existing_domain_refs', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  geniusAssessments: text('genius_assessments', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  humanQuestions: text('human_questions', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => []),
  status: text('status').notNull().default('pending'),
  revision: integer('revision').notNull().default(1),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const uxBoundaryDecisions = sqliteTable('ux_boundary_decisions', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull(),
  proposalId: text('proposal_id').notNull(),
  action: text('action').notNull(),
  proposalRevision: integer('proposal_revision').notNull(),
  rationale: text('rationale').notNull(),
  resultBoundaries: text('result_boundaries', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  decidedBy: text('decided_by').notNull(),
  geniusPublishStatus: text('genius_publish_status').notNull().default('not_requested'),
  geniusCardId: text('genius_card_id'),
  geniusError: text('genius_error'),
  createdAt: ts('created_at').notNull().$defaultFn(now),
});

export const uxEvidence = sqliteTable('ux_evidence', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull(),
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
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  recordedBy: text('recorded_by').notNull(),
  recordedAt: ts('recorded_at').notNull().$defaultFn(now),
});

export const uxImageAnalyses = sqliteTable('ux_image_analyses', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull(),
  baseCanvasRevision: integer('base_canvas_revision').notNull(),
  imageFingerprint: text('image_fingerprint').notNull(),
  status: text('status').notNull().default('running'),
  candidates: text('candidates', { mode: 'json' }).$type<Record<string, unknown>[]>().notNull().$defaultFn(() => []),
  errorCode: text('error_code'),
  requestedBy: text('requested_by').notNull(),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  completedAt: ts('completed_at'),
});

export const auditLog = sqliteTable('audit_log', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  projectId: text('project_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  actorDisplayName: text('actor_display_name'),
  action: text('action').notNull(),
  targetKind: text('target_kind'),
  targetId: text('target_id'),
  meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: ts('created_at').notNull().$defaultFn(now),
});

/** drizzle(sqlite, { schema }) に渡す束。 */
export const sqliteTables = {
  sceneDocuments: sceneDocumentsSqlite,
  featureManuals: featureManualsSqlite,
  projects, projectMembers, dataDesigns, specFragments, domains, objects, objectAttrs, assets, objectAssets,
  layouts, layoutObjects, specs, specTargets, specAcceptance,
  codeGraphNodes, codeGraphEdges, codeGraphRuns, auditLog,
  transitions, specConversations, specMessages, ccLinks,
  uxScenarios, uxUseCases, uxCanvases, uxAnalysisRuns, uxBoundaryProposals,
  uxBoundaryDecisions, uxEvidence, uxImageAnalyses,
};

/** 起動時に流す DDL (CREATE TABLE IF NOT EXISTS + 必要な UNIQUE INDEX)。 FK は張らない (ローカル単一利用)。 */
/** 既存 DB へ後から足す列 (重複時はエラーになるので connection 側で個別に try する)。 */
export const SQLITE_ALTERS: string[] = [
  `ALTER TABLE objects ADD COLUMN description TEXT`,
  `ALTER TABLE projects ADD COLUMN ux_experience TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE projects ADD COLUMN ux_design TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE projects ADD COLUMN ux_goal TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE projects ADD COLUMN ux_goal_revision INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE domains ADD COLUMN definition_kind TEXT`,
  `ALTER TABLE domains ADD COLUMN definition_value TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE domains ADD COLUMN definition_scene_ids TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE domains ADD COLUMN definition_revision INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE domains ADD COLUMN anatomia_domain TEXT`,
  `ALTER TABLE projects ADD COLUMN anatomia_repo TEXT`,
];

export const SQLITE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS llm_chats (project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, data TEXT, PRIMARY KEY(project_id,user_id))`,
  ...MANUAL_DDL,
  ...SCENE_DDL,
  `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, org_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, platforms TEXT NOT NULL DEFAULT '["web"]', default_layout_id TEXT, anatomia_repo TEXT, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS data_designs (project_id TEXT PRIMARY KEY REFERENCES projects(id), definition TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision > 0), updated_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  // projects より後に置く (REFERENCES projects(id) を持つ他テーブルと同じ順序)。
  `CREATE TABLE IF NOT EXISTS spec_fragments (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), content TEXT NOT NULL, source TEXT NOT NULL, source_event_id TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, implementation_state TEXT NOT NULL DEFAULT 'unimplemented' CHECK (implementation_state IN ('unverified','unimplemented','implemented')), implementation_evidence TEXT NOT NULL DEFAULT '', implementation_updated_by TEXT, implementation_updated_at INTEGER, revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_fragments_event ON spec_fragments(project_id, source, source_event_id)`,
  `CREATE INDEX IF NOT EXISTS idx_spec_fragments_project ON spec_fragments(project_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS project_members (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer', display_name TEXT, joined_at INTEGER, last_seen_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_project_members_project_user ON project_members(project_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS domains (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, color TEXT NOT NULL DEFAULT '#888888', icon TEXT, parent_id TEXT, max_count INTEGER, required_attrs TEXT NOT NULL DEFAULT '[]', anatomia_domain TEXT, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_domains_project_name ON domains(project_id, name)`,
  `CREATE TABLE IF NOT EXISTS objects (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, domain_id TEXT NOT NULL, label TEXT NOT NULL, placeholder_shape TEXT NOT NULL DEFAULT 'cube', placeholder_color TEXT NOT NULL DEFAULT '#888888', placeholder_image_asset_id TEXT, parent_object_id TEXT, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS object_attrs (id INTEGER PRIMARY KEY AUTOINCREMENT, object_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, inherited_from TEXT, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_object_attrs_object_key ON object_attrs(object_id, key)`,
  `CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, mime_type TEXT, storage_url TEXT NOT NULL, size_bytes INTEGER, checksum_sha256 TEXT, meta TEXT NOT NULL DEFAULT '{}', uploaded_by TEXT NOT NULL, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS object_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, object_id TEXT NOT NULL, platform TEXT NOT NULL, asset_id TEXT NOT NULL, transform_override TEXT, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_object_assets_object_platform ON object_assets(object_id, platform)`,
  `CREATE TABLE IF NOT EXISTS layouts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, kind TEXT NOT NULL DEFAULT 'world-3d', is_default INTEGER NOT NULL DEFAULT 0, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS layout_objects (id TEXT PRIMARY KEY, layout_id TEXT NOT NULL, object_id TEXT NOT NULL, position TEXT NOT NULL DEFAULT '[0,0,0]', rotation TEXT NOT NULL DEFAULT '[0,0,0]', scale TEXT NOT NULL DEFAULT '[1,1,1]', parent_layout_object_id TEXT, lock_transform INTEGER NOT NULL DEFAULT 0, ordinal INTEGER NOT NULL DEFAULT 0, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_layout_objects_layout_object ON layout_objects(layout_id, object_id)`,
  `CREATE TABLE IF NOT EXISTS transitions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, from_layout_id TEXT NOT NULL, source_object_id TEXT, to_layout_id TEXT NOT NULL, trigger TEXT NOT NULL DEFAULT 'tap', condition TEXT NOT NULL DEFAULT '', label TEXT, ordinal INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_transitions_source_condition ON transitions(source_object_id, condition) WHERE source_object_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_transitions_layout_trigger_condition ON transitions(from_layout_id, trigger, condition) WHERE source_object_id IS NULL`,
  `CREATE TABLE IF NOT EXISTS spec_conversations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, title TEXT, created_by TEXT NOT NULL, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_conversations_target ON spec_conversations(project_id, target_kind, target_id)`,
  `CREATE TABLE IF NOT EXISTS spec_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, proposals TEXT NOT NULL DEFAULT '[]', applied INTEGER NOT NULL DEFAULT 0, created_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS cc_links (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, cc_kind TEXT NOT NULL, cc_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', last_synced_at INTEGER, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_links_cc ON cc_links(project_id, cc_kind, cc_id)`,
  `CREATE TABLE IF NOT EXISTS specs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL, description TEXT, priority TEXT NOT NULL DEFAULT 'should', category TEXT NOT NULL DEFAULT 'behavior', preconditions TEXT NOT NULL DEFAULT '[]', postconditions TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_specs_project_code ON specs(project_id, code)`,
  `CREATE TABLE IF NOT EXISTS spec_targets (id INTEGER PRIMARY KEY AUTOINCREMENT, spec_id TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_targets_spec_kind_ref ON spec_targets(spec_id, kind, ref_id)`,
  `CREATE TABLE IF NOT EXISTS spec_acceptance (id TEXT PRIMARY KEY, spec_id TEXT NOT NULL, ordinal INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'manual', expression TEXT, kind TEXT NOT NULL DEFAULT 'positive', enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS code_graph_nodes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, node_key TEXT NOT NULL, label TEXT NOT NULL, node_type TEXT NOT NULL DEFAULT 'symbol', anatomia_ref TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL DEFAULT 'anatomia', status TEXT NOT NULL DEFAULT 'linked', meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_code_graph_nodes_target_key ON code_graph_nodes(project_id, target_kind, target_id, node_key)`,
  `CREATE TABLE IF NOT EXISTS code_graph_edges (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, from_node TEXT NOT NULL, to_node TEXT NOT NULL, relation TEXT NOT NULL DEFAULT 'related', source TEXT NOT NULL DEFAULT 'anatomia', meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_code_graph_edges_triple ON code_graph_edges(from_node, to_node, relation)`,
  `CREATE TABLE IF NOT EXISTS ux_scenarios (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, actor TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', goal TEXT NOT NULL, success_outcome TEXT NOT NULL, source_project_key TEXT, source_refs TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', revision INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_ux_scenarios_project_name ON ux_scenarios(project_id, name)`,
  `CREATE TABLE IF NOT EXISTS ux_use_cases (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, title TEXT NOT NULL, user_intent TEXT NOT NULL, trigger TEXT NOT NULL, preconditions TEXT NOT NULL DEFAULT '[]', success_outcome TEXT NOT NULL, failure_outcomes TEXT NOT NULL DEFAULT '[]', interruption_recovery TEXT NOT NULL DEFAULT '', ordinal INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS ux_canvases (scenario_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, frames TEXT NOT NULL DEFAULT '[]', elements TEXT NOT NULL DEFAULT '[]', transitions TEXT NOT NULL DEFAULT '[]', applied_image_analysis_ids TEXT NOT NULL DEFAULT '[]', updated_by TEXT NOT NULL, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS ux_analysis_runs (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, scenario_revision INTEGER NOT NULL, use_case_ids TEXT NOT NULL DEFAULT '[]', use_case_revisions TEXT NOT NULL DEFAULT '{}', note TEXT, visibility TEXT NOT NULL DEFAULT 'sensitive', status TEXT NOT NULL DEFAULT 'running', anatomia_source_revision TEXT, genius_query TEXT NOT NULL DEFAULT '{}', error_code TEXT, requested_by TEXT NOT NULL, created_at INTEGER, completed_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS ux_boundary_proposals (id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, scenario_id TEXT NOT NULL, use_case_ids TEXT NOT NULL DEFAULT '[]', name TEXT NOT NULL, purpose TEXT NOT NULL, classification TEXT NOT NULL, responsibilities TEXT NOT NULL DEFAULT '[]', business_rules TEXT NOT NULL DEFAULT '[]', in_scope TEXT NOT NULL DEFAULT '[]', out_of_scope TEXT NOT NULL DEFAULT '[]', collaborations TEXT NOT NULL DEFAULT '[]', assumptions TEXT NOT NULL DEFAULT '[]', unresolved_questions TEXT NOT NULL DEFAULT '[]', alternatives TEXT NOT NULL DEFAULT '[]', confidence INTEGER NOT NULL, rationale TEXT NOT NULL, existing_domain_refs TEXT NOT NULL DEFAULT '[]', genius_assessments TEXT NOT NULL DEFAULT '[]', human_questions TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending', revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS ux_boundary_decisions (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, proposal_id TEXT NOT NULL, action TEXT NOT NULL, proposal_revision INTEGER NOT NULL, rationale TEXT NOT NULL, result_boundaries TEXT NOT NULL DEFAULT '[]', decided_by TEXT NOT NULL, genius_publish_status TEXT NOT NULL DEFAULT 'not_requested', genius_card_id TEXT, genius_error TEXT, created_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_ux_boundary_decisions_proposal_revision ON ux_boundary_decisions(proposal_id, proposal_revision)`,
  `CREATE TABLE IF NOT EXISTS ux_evidence (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL, source_project_key TEXT NOT NULL, source_revision TEXT NOT NULL, source_ref TEXT NOT NULL, status TEXT NOT NULL, scenario_revision INTEGER NOT NULL, use_case_revision INTEGER, canvas_revision INTEGER, payload TEXT NOT NULL DEFAULT '{}', recorded_by TEXT NOT NULL, recorded_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_ux_evidence_provenance ON ux_evidence(scenario_id, target_kind, target_id, kind, source_project_key, source_revision, source_ref)`,
  `CREATE TABLE IF NOT EXISTS ux_image_analyses (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, base_canvas_revision INTEGER NOT NULL, image_fingerprint TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', candidates TEXT NOT NULL DEFAULT '[]', error_code TEXT, requested_by TEXT NOT NULL, created_at INTEGER, completed_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS code_graph_runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, query TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'ok', node_count INTEGER NOT NULL DEFAULT 0, edge_count INTEGER NOT NULL DEFAULT 0, summary TEXT, raw TEXT NOT NULL DEFAULT '{}', requested_by TEXT NOT NULL, created_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, actor_display_name TEXT, action TEXT NOT NULL, target_kind TEXT, target_id TEXT, meta TEXT NOT NULL DEFAULT '{}', ip TEXT, user_agent TEXT, created_at INTEGER)`,
  ...SPEC_VERSION_DDL,
];
