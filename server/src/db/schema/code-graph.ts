// code_graph_nodes + code_graph_edges + code_graph_runs — spec/schema/code-graph.md
//
// 要件定義モード (Studio) で domain / layout(=scene) に紐付く要件束を、 MUSA(Thaleia)
// 経由で Anatomia にリレーして得た「関連処理グラフ」を保存する器。

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import {
  codeGraphNodes as codeGraphNodesSqlite,
  codeGraphEdges as codeGraphEdgesSqlite,
  codeGraphRuns as codeGraphRunsSqlite,
} from '../sqlite-schema.ts';

/** 要件束の対象種別。 既存 spec_targets の kind のうちグラフを張る 2 種。 */
export type GraphTargetKind = 'domain' | 'layout';
export type GraphNodeType = 'symbol' | 'file' | 'domain' | 'spec' | 'external';
export type GraphSource = 'anatomia' | 'manual';
export type GraphNodeStatus = 'linked' | 'candidate' | 'dismissed';
export type GraphRelation = 'calls' | 'depends' | 'implements' | 'related';

/** Anatomia ノードの生ペイロード (domain/layer/path 等)。 形は供給側に委ねるので緩い。 */
export interface AnatomiaRef {
  domain?: string;
  layer?: string;
  path?: string;
  symbol?: string;
  kind?: string;
  [k: string]: unknown;
}

const codeGraphNodesPg = pgTable(
  'code_graph_nodes',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    targetKind: text('target_kind').$type<GraphTargetKind>().notNull(),
    targetId: text('target_id').notNull(),
    nodeKey: text('node_key').notNull(),
    label: text('label').notNull(),
    nodeType: text('node_type').$type<GraphNodeType>().notNull().default('symbol'),
    anatomiaRef: jsonb('anatomia_ref').$type<AnatomiaRef>().notNull().default({}),
    source: text('source').$type<GraphSource>().notNull().default('anatomia'),
    status: text('status').$type<GraphNodeStatus>().notNull().default('linked'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTargetKey: uniqueIndex('uq_code_graph_nodes_target_key').on(
      t.projectId,
      t.targetKind,
      t.targetId,
      t.nodeKey,
    ),
    idxTarget: index('idx_code_graph_nodes_target').on(t.projectId, t.targetKind, t.targetId),
  }),
);

const codeGraphEdgesPg = pgTable(
  'code_graph_edges',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    targetKind: text('target_kind').$type<GraphTargetKind>().notNull(),
    targetId: text('target_id').notNull(),
    fromNode: text('from_node')
      .notNull()
      .references(() => codeGraphNodes.id),
    toNode: text('to_node')
      .notNull()
      .references(() => codeGraphNodes.id),
    relation: text('relation').$type<GraphRelation>().notNull().default('related'),
    source: text('source').$type<GraphSource>().notNull().default('anatomia'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTriple: uniqueIndex('uq_code_graph_edges_triple').on(t.fromNode, t.toNode, t.relation),
    idxTarget: index('idx_code_graph_edges_target').on(t.projectId, t.targetKind, t.targetId),
  }),
);

export type GraphRunStatus = 'ok' | 'error' | 'musa_unconfigured';

const codeGraphRunsPg = pgTable(
  'code_graph_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    targetKind: text('target_kind').$type<GraphTargetKind>().notNull(),
    targetId: text('target_id').notNull(),
    query: text('query').notNull().default(''),
    status: text('status').$type<GraphRunStatus>().notNull().default('ok'),
    nodeCount: integer('node_count').notNull().default(0),
    edgeCount: integer('edge_count').notNull().default(0),
    summary: text('summary'),
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
    requestedBy: text('requested_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTarget: index('idx_code_graph_runs_target').on(
      t.projectId,
      t.targetKind,
      t.targetId,
      t.createdAt,
    ),
  }),
);

export const codeGraphNodes = LOCAL_MODE
  ? (codeGraphNodesSqlite as unknown as typeof codeGraphNodesPg)
  : codeGraphNodesPg;
export const codeGraphEdges = LOCAL_MODE
  ? (codeGraphEdgesSqlite as unknown as typeof codeGraphEdgesPg)
  : codeGraphEdgesPg;
export const codeGraphRuns = LOCAL_MODE
  ? (codeGraphRunsSqlite as unknown as typeof codeGraphRunsPg)
  : codeGraphRunsPg;
