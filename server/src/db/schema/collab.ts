// edit_sessions + edit_ops + audit_log — spec/schema/collab.md

import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { auditLog as auditLogSqlite } from '../sqlite-schema.ts';

export const editSessions = pgTable(
  'edit_sessions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    userId: text('user_id').notNull(),
    clientKind: text('client_kind').notNull(),
    cursor: jsonb('cursor').$type<Record<string, unknown>>(),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  },
  (t) => ({
    idxProjectActive: index('idx_edit_sessions_project_active').on(t.projectId),
    idxUser: index('idx_edit_sessions_user').on(t.userId),
  }),
);

export const editOps = pgTable(
  'edit_ops',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    sessionId: text('session_id'),
    userId: text('user_id').notNull(),
    op: text('op').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    prevVersion: integer('prev_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxProjectIdDesc: index('idx_edit_ops_project_id_desc').on(t.projectId, t.id),
    idxTarget: index('idx_edit_ops_target').on(t.targetKind, t.targetId),
  }),
);

const auditLogPg = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    actorUserId: text('actor_user_id').notNull(),
    actorDisplayName: text('actor_display_name'),
    action: text('action').notNull(),
    targetKind: text('target_kind'),
    targetId: text('target_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxProject: index('idx_audit_log_project').on(t.projectId, t.createdAt),
    idxActor: index('idx_audit_log_actor').on(t.actorUserId, t.createdAt),
    idxAction: index('idx_audit_log_action').on(t.projectId, t.action),
  }),
);

export const auditLog = LOCAL_MODE
  ? (auditLogSqlite as unknown as typeof auditLogPg)
  : auditLogPg;
