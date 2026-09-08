/** Project-owned schema design documents. spec/data/schema/data-design.md */
import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import type { DataDesign } from '../../../../shared/data-design.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { dataDesigns as sqliteDataDesigns } from '../sqlite-schema.ts';

const dataDesignsPg = pgTable('data_designs', {
  projectId: text('project_id').primaryKey().references(() => projects.id),
  definition: jsonb('definition').$type<DataDesign>().notNull(),
  revision: integer('revision').notNull(),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dataDesigns = LOCAL_MODE
  ? (sqliteDataDesigns as unknown as typeof dataDesignsPg)
  : dataDesignsPg;
