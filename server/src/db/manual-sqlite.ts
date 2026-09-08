import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { ManualPayload } from './schema/feature-manual.ts';
export const featureManualsSqlite = sqliteTable('feature_manuals', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(),
  payload: text('payload', { mode: 'json' }).$type<ManualPayload>().notNull(),
  revision: integer('revision').notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const MANUAL_DDL = [
  'CREATE TABLE IF NOT EXISTS feature_manuals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_feature_manuals_project ON feature_manuals(project_id)',
];
