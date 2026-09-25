import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { ConceptSheetPayload } from './schema/concept-sheet.ts';
export const conceptSheetsSqlite = sqliteTable('concept_sheets', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(),
  payload: text('payload', { mode: 'json' }).$type<ConceptSheetPayload>().notNull(),
  revision: integer('revision').notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const CONCEPT_SHEET_DDL = [
  'CREATE TABLE IF NOT EXISTS concept_sheets (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_concept_sheets_project ON concept_sheets(project_id)',
];
