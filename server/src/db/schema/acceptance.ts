// acceptance_runs + acceptance_results — spec/schema/acceptance.md

import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { layouts } from './layout.ts';
import { specAcceptance } from './spec.ts';

export const acceptanceRuns = pgTable(
  'acceptance_runs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    layoutId: text('layout_id')
      .notNull()
      .references(() => layouts.id),
    platform: text('platform').notNull(),
    trigger: text('trigger').notNull().default('manual'),
    seed: text('seed'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status').notNull().default('running'),
    summary: jsonb('summary').$type<Record<string, number>>().notNull().default({}),
    triggeredBy: text('triggered_by'),
  },
  (t) => ({
    idxProject: index('idx_acceptance_runs_project').on(t.projectId, t.startedAt),
    idxLayout: index('idx_acceptance_runs_layout').on(t.layoutId, t.startedAt),
  }),
);

export const acceptanceResults = pgTable(
  'acceptance_results',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => acceptanceRuns.id),
    acceptanceId: text('acceptance_id')
      .notNull()
      .references(() => specAcceptance.id),
    status: text('status').notNull(),
    observed: jsonb('observed').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    logExcerpt: text('log_excerpt'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer('duration_ms').notNull().default(0),
  },
  (t) => ({
    uniqRunAcceptance: uniqueIndex('uq_acceptance_results_run_acceptance').on(
      t.runId,
      t.acceptanceId,
    ),
    idxRun: index('idx_acceptance_results_run').on(t.runId),
    idxAcceptance: index('idx_acceptance_results_acceptance').on(
      t.acceptanceId,
      t.startedAt,
    ),
  }),
);
