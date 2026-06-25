// domains — spec/schema/domain.md
// オブジェクトの役割 / カテゴリ。 継承可 (parent_id)。

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
import { domains as domainsSqlite } from '../sqlite-schema.ts';

export interface RequiredAttr {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  default?: unknown;
  enum?: string[];
}

const domainsPg = pgTable(
  'domains',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('#888888'),
    icon: text('icon'),
    parentId: text('parent_id'),
    maxCount: integer('max_count'),
    requiredAttrs: jsonb('required_attrs').$type<RequiredAttr[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqProjectName: uniqueIndex('uq_domains_project_name').on(t.projectId, t.name),
    idxProject: index('idx_domains_project').on(t.projectId),
    idxParent: index('idx_domains_parent').on(t.parentId),
  }),
);

export const domains = LOCAL_MODE
  ? (domainsSqlite as unknown as typeof domainsPg)
  : domainsPg;
