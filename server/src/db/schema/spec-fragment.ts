/** Immutable specification input with separately editable implementation evidence. */
import { pgTable, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import type { ImplementationState } from '../../../../shared/spec-fragments.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { specFragments as sqliteFragments } from '../sqlite-schema.ts';

const specFragmentsPg = pgTable('spec_fragments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  content: text('content').notNull(),
  source: text('source').notNull(),
  sourceEventId: text('source_event_id').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  implementationState: text('implementation_state').$type<ImplementationState>().notNull().default('unimplemented'),
  implementationEvidence: text('implementation_evidence').notNull().default(''),
  implementationUpdatedBy: text('implementation_updated_by'),
  implementationUpdatedAt: timestamp('implementation_updated_at', { withTimezone: true }),
  revision: integer('revision').notNull().default(1),
}, (table) => ({
  sourceEvent: uniqueIndex('uq_spec_fragments_event').on(table.projectId, table.source, table.sourceEventId),
  project: index('idx_spec_fragments_project').on(table.projectId, table.createdAt),
}));

export const specFragments = LOCAL_MODE ? (sqliteFragments as unknown as typeof specFragmentsPg) : specFragmentsPg;
