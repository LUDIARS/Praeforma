// SQLite 版スキーマ (ローカル「仕様書レビュー」モード用、 Studio 最小サブセット 15 テーブル)。
//
// 既存 pg スキーマと同じテーブル名 / カラム名 / JS キーで定義し、 各 pg schema ファイルが
// LOCAL_MODE 時にこちらを (pg 型へキャストして) 再エクスポートする。 ルートは無改変で sqlite を叩く。
//
// 型対応: jsonb → text{json} / timestamptz → integer{timestamp_ms} / bigserial →
//         integer autoincrement / boolean → integer{boolean}。
// 永続化対象外 (objects/assets 等も含めた最小集合)。 認証/個人データは持たない。

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const now = () => new Date();

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  orgId: text('org_id').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  platforms: text('platforms', { mode: 'json' }).$type<string[]>().notNull().$defaultFn(() => ['web']),
  defaultLayoutId: text('default_layout_id'),
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

export const domains = sqliteTable('domains', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#888888'),
  icon: text('icon'),
  parentId: text('parent_id'),
  maxCount: integer('max_count'),
  requiredAttrs: text('required_attrs', { mode: 'json' }).$type<unknown[]>().notNull().$defaultFn(() => []),
  createdAt: ts('created_at').notNull().$defaultFn(now),
  updatedAt: ts('updated_at').notNull().$defaultFn(now),
});

export const objects = sqliteTable('objects', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  domainId: text('domain_id').notNull(),
  label: text('label').notNull(),
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
  projects, projectMembers, domains, objects, objectAttrs, assets, objectAssets,
  layouts, specs, specTargets, specAcceptance,
  codeGraphNodes, codeGraphEdges, codeGraphRuns, auditLog,
};

/** 起動時に流す DDL (CREATE TABLE IF NOT EXISTS + 必要な UNIQUE INDEX)。 FK は張らない (ローカル単一利用)。 */
export const SQLITE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, org_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, platforms TEXT NOT NULL DEFAULT '["web"]', default_layout_id TEXT, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS project_members (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer', display_name TEXT, joined_at INTEGER, last_seen_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_project_members_project_user ON project_members(project_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS domains (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, color TEXT NOT NULL DEFAULT '#888888', icon TEXT, parent_id TEXT, max_count INTEGER, required_attrs TEXT NOT NULL DEFAULT '[]', created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_domains_project_name ON domains(project_id, name)`,
  `CREATE TABLE IF NOT EXISTS objects (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, domain_id TEXT NOT NULL, label TEXT NOT NULL, placeholder_shape TEXT NOT NULL DEFAULT 'cube', placeholder_color TEXT NOT NULL DEFAULT '#888888', placeholder_image_asset_id TEXT, parent_object_id TEXT, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS object_attrs (id INTEGER PRIMARY KEY AUTOINCREMENT, object_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, inherited_from TEXT, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_object_attrs_object_key ON object_attrs(object_id, key)`,
  `CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, mime_type TEXT, storage_url TEXT NOT NULL, size_bytes INTEGER, checksum_sha256 TEXT, meta TEXT NOT NULL DEFAULT '{}', uploaded_by TEXT NOT NULL, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS object_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, object_id TEXT NOT NULL, platform TEXT NOT NULL, asset_id TEXT NOT NULL, transform_override TEXT, created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_object_assets_object_platform ON object_assets(object_id, platform)`,
  `CREATE TABLE IF NOT EXISTS layouts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, kind TEXT NOT NULL DEFAULT 'world-3d', is_default INTEGER NOT NULL DEFAULT 0, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS specs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL, description TEXT, priority TEXT NOT NULL DEFAULT 'should', category TEXT NOT NULL DEFAULT 'behavior', preconditions TEXT NOT NULL DEFAULT '[]', postconditions TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at INTEGER, updated_at INTEGER, deleted_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_specs_project_code ON specs(project_id, code)`,
  `CREATE TABLE IF NOT EXISTS spec_targets (id INTEGER PRIMARY KEY AUTOINCREMENT, spec_id TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_spec_targets_spec_kind_ref ON spec_targets(spec_id, kind, ref_id)`,
  `CREATE TABLE IF NOT EXISTS spec_acceptance (id TEXT PRIMARY KEY, spec_id TEXT NOT NULL, ordinal INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'manual', expression TEXT, kind TEXT NOT NULL DEFAULT 'positive', enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER, updated_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS code_graph_nodes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, node_key TEXT NOT NULL, label TEXT NOT NULL, node_type TEXT NOT NULL DEFAULT 'symbol', anatomia_ref TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL DEFAULT 'anatomia', status TEXT NOT NULL DEFAULT 'linked', meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER, updated_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_code_graph_nodes_target_key ON code_graph_nodes(project_id, target_kind, target_id, node_key)`,
  `CREATE TABLE IF NOT EXISTS code_graph_edges (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, from_node TEXT NOT NULL, to_node TEXT NOT NULL, relation TEXT NOT NULL DEFAULT 'related', source TEXT NOT NULL DEFAULT 'anatomia', meta TEXT NOT NULL DEFAULT '{}', created_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_code_graph_edges_triple ON code_graph_edges(from_node, to_node, relation)`,
  `CREATE TABLE IF NOT EXISTS code_graph_runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, query TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'ok', node_count INTEGER NOT NULL DEFAULT 0, edge_count INTEGER NOT NULL DEFAULT 0, summary TEXT, raw TEXT NOT NULL DEFAULT '{}', requested_by TEXT NOT NULL, created_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, actor_display_name TEXT, action TEXT NOT NULL, target_kind TEXT, target_id TEXT, meta TEXT NOT NULL DEFAULT '{}', ip TEXT, user_agent TEXT, created_at INTEGER)`,
];
