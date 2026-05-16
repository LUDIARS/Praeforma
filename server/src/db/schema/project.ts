// projects + project_members — spec/schema/project.md
//
// 個人データは Cernere 単一情報源。 Praeforma DB は Cernere user UUID +
// display_name snapshot のみ保持する。

import { jsonb, pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    orgId: text('org_id').notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    platforms: jsonb('platforms').$type<string[]>().notNull().default(['web']),
    defaultLayoutId: text('default_layout_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxOrg: index('idx_projects_org').on(t.orgId),
    idxOwner: index('idx_projects_owner').on(t.ownerUserId),
  }),
);

export const projectMembers = pgTable(
  'project_members',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('viewer'),
    displayName: text('display_name'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => ({
    uniqProjectUser: uniqueIndex('uq_project_members_project_user').on(
      t.projectId,
      t.userId,
    ),
    idxProject: index('idx_project_members_project').on(t.projectId),
    idxUser: index('idx_project_members_user').on(t.userId),
  }),
);

export type ProjectRole =
  | 'owner'
  | 'planner'
  | 'designer'
  | 'programmer'
  | 'reviewer'
  | 'viewer';
