import { pgTable, text, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { ManualDocument, ManualSource } from '../../../../shared/feature-manual.ts';
import { projects } from './project.ts';
import { SQLITE_STORAGE } from '../mode.ts';
import { featureManualsSqlite } from '../manual-sqlite.ts';
export interface ManualPayload {
  document: ManualDocument | null;
  proposal: ManualDocument;
  source: ManualSource;
  publishedSource: ManualSource | null;
}
const featureManualsPg = pgTable('feature_manuals', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  payload: jsonb('payload').$type<ManualPayload>().notNull(), revision: integer('revision').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, t => ({ project: index('idx_feature_manuals_project').on(t.projectId) }));
export const featureManuals = SQLITE_STORAGE ? featureManualsSqlite as unknown as typeof featureManualsPg : featureManualsPg;
