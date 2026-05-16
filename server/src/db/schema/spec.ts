// specs + spec_targets + spec_acceptance — spec/schema/spec.md

import {
  bigserial,
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

export const specs = pgTable(
  'specs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority').notNull().default('should'),
    category: text('category').notNull().default('behavior'),
    preconditions: jsonb('preconditions').$type<string[]>().notNull().default([]),
    postconditions: jsonb('postconditions').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqProjectCode: uniqueIndex('uq_specs_project_code').on(t.projectId, t.code),
    idxProject: index('idx_specs_project').on(t.projectId),
    idxStatus: index('idx_specs_status').on(t.projectId, t.status),
  }),
);

export const specTargets = pgTable(
  'spec_targets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    specId: text('spec_id')
      .notNull()
      .references(() => specs.id),
    kind: text('kind').notNull(),
    refId: text('ref_id').notNull(),
  },
  (t) => ({
    uniqSpecKindRef: uniqueIndex('uq_spec_targets_spec_kind_ref').on(
      t.specId,
      t.kind,
      t.refId,
    ),
    idxSpec: index('idx_spec_targets_spec').on(t.specId),
    idxRef: index('idx_spec_targets_ref').on(t.kind, t.refId),
  }),
);

export const specAcceptance = pgTable(
  'spec_acceptance',
  {
    id: text('id').primaryKey(),
    specId: text('spec_id')
      .notNull()
      .references(() => specs.id),
    ordinal: integer('ordinal').notNull().default(0),
    text: text('text').notNull(),
    level: text('level').notNull().default('manual'),
    expression: text('expression'),
    kind: text('kind').notNull().default('positive'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxSpec: index('idx_spec_acceptance_spec').on(t.specId),
  }),
);
