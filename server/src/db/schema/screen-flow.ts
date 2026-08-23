// transitions + spec_conversations + spec_messages + cc_links — spec/data/schema/screen-flow.md
//
// Screen Flow: UI 要素 (layout_objects) 起点の画面遷移、 LLM トークエリアの会話、
// Concordia への接続記録。 domains.anatomia_domain / projects.anatomia_repo は各 schema 側。
//
// @spec 3. データモデル

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { layouts, layoutObjects } from './layout.ts';
import { LOCAL_MODE } from '../mode.ts';
import {
  transitions as transitionsSqlite,
  specConversations as specConversationsSqlite,
  specMessages as specMessagesSqlite,
  ccLinks as ccLinksSqlite,
} from '../sqlite-schema.ts';

export type ConversationTargetKind = 'project' | 'domain' | 'layout' | 'object' | 'transition';
export type MessageRole = 'user' | 'assistant' | 'system';
export type CcTargetKind = 'spec' | 'layout' | 'transition';
export type CcKind = 'delegation_run' | 'taskflow_task';
export type CcStatus = 'queued' | 'running' | 'done' | 'failed';

/**
 * LLM が返す提案。 UI で個別に「反映」されるまで DB には書かれない (feature §5.3)。
 *
 * `applied` は反映済みの印。 message 単位の `spec_messages.applied` だけだと
 * 「1 件目を反映 → 残りも反映済み扱い」 または 「再読み込みで全件また押せる」 のどちらかになるため、
 * 提案ごとに立てて二重作成を防ぐ (§5.3)。
 */
export type Proposal =
  | {
      kind: 'spec';
      target: { kind: 'domain' | 'layout' | 'object' | 'transition' | 'project'; id: string };
      title: string;
      description: string;
      priority?: 'must' | 'should' | 'could' | 'wont';
      category?: 'behavior' | 'appearance' | 'data' | 'interaction';
      acceptance?: string[];
      applied?: boolean;
    }
  | {
      kind: 'transition';
      from_layout_id: string;
      source_object_id: string | null;
      to_layout_id: string;
      trigger: string;
      condition?: string | null;
      label?: string | null;
      applied?: boolean;
    }
  | {
      kind: 'object';
      layout_id: string;
      widget: string;
      label: string;
      action?: string;
      applied?: boolean;
    };

const transitionsPg = pgTable(
  'transitions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    fromLayoutId: text('from_layout_id')
      .notNull()
      .references(() => layouts.id),
    sourceObjectId: text('source_object_id').references(() => layoutObjects.id, {
      onDelete: 'cascade',
    }),
    toLayoutId: text('to_layout_id')
      .notNull()
      .references(() => layouts.id),
    trigger: text('trigger').notNull().default('tap'),
    condition: text('condition').notNull().default(''),
    label: text('label'),
    ordinal: integer('ordinal').notNull().default(0),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxProject: index('idx_transitions_project').on(t.projectId),
    idxFrom: index('idx_transitions_from').on(t.fromLayoutId),
    idxTo: index('idx_transitions_to').on(t.toLayoutId),
  }),
);

const specConversationsPg = pgTable(
  'spec_conversations',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    targetKind: text('target_kind').$type<ConversationTargetKind>().notNull(),
    targetId: text('target_id').notNull(),
    title: text('title'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTarget: uniqueIndex('uq_spec_conversations_target').on(
      t.projectId,
      t.targetKind,
      t.targetId,
    ),
  }),
);

const specMessagesPg = pgTable(
  'spec_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => specConversationsPg.id, { onDelete: 'cascade' }),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    proposals: jsonb('proposals').$type<Proposal[]>().notNull().default([]),
    applied: boolean('applied').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxConversation: index('idx_spec_messages_conversation').on(t.conversationId, t.createdAt),
  }),
);

const ccLinksPg = pgTable(
  'cc_links',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    targetKind: text('target_kind').$type<CcTargetKind>().notNull(),
    targetId: text('target_id').notNull(),
    ccKind: text('cc_kind').$type<CcKind>().notNull(),
    ccId: text('cc_id').notNull(),
    status: text('status').$type<CcStatus>().notNull().default('queued'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqCc: uniqueIndex('uq_cc_links_cc').on(t.projectId, t.ccKind, t.ccId),
    idxTarget: index('idx_cc_links_target').on(t.projectId, t.targetKind, t.targetId),
  }),
);

export const transitions = LOCAL_MODE
  ? (transitionsSqlite as unknown as typeof transitionsPg)
  : transitionsPg;
export const specConversations = LOCAL_MODE
  ? (specConversationsSqlite as unknown as typeof specConversationsPg)
  : specConversationsPg;
export const specMessages = LOCAL_MODE
  ? (specMessagesSqlite as unknown as typeof specMessagesPg)
  : specMessagesPg;
export const ccLinks = LOCAL_MODE ? (ccLinksSqlite as unknown as typeof ccLinksPg) : ccLinksPg;
