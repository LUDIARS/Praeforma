import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import type { ConceptSheetVersionKind, ConceptSheetVisualRef } from '../../../shared/concept-sheet.ts';
import type { ConceptSheetPayload, ConceptSheetVersionPayload } from './schema/concept-sheet.ts';
export const conceptSheetsSqlite = sqliteTable('concept_sheets', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(),
  payload: text('payload', { mode: 'json' }).$type<ConceptSheetPayload>().notNull(),
  revision: integer('revision').notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  autoUpdate: integer('auto_update', { mode: 'boolean' }).notNull().default(true), latestRv: integer('latest_rv').notNull().default(1),
});
export const conceptSheetVersionsSqlite = sqliteTable('concept_sheet_versions', {
  sheetId: text('sheet_id').notNull(), rv: integer('rv').notNull(), projectId: text('project_id').notNull(),
  payload: text('payload', { mode: 'json' }).$type<ConceptSheetVersionPayload>().notNull(),
  visualRefs: text('visual_refs', { mode: 'json' }).$type<ConceptSheetVisualRef[]>().notNull(),
  kind: text('kind').$type<ConceptSheetVersionKind>().notNull(), createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, t => ({ pk: primaryKey({ columns: [t.sheetId, t.rv] }) }));
export const CONCEPT_SHEET_DDL = [
  'CREATE TABLE IF NOT EXISTS concept_sheets (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_concept_sheets_project ON concept_sheets(project_id)',
  // 版 (PF-CS-10)。Postgres は migration 021。
  'CREATE TABLE IF NOT EXISTS concept_sheet_versions (sheet_id TEXT NOT NULL, rv INTEGER NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL, visual_refs TEXT NOT NULL DEFAULT \'[]\', kind TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(sheet_id, rv))',
  'CREATE INDEX IF NOT EXISTS idx_concept_sheet_versions_project ON concept_sheet_versions(project_id)',
];
/** 既存の concept_sheets へ後から足す列 (migration 021 と同じ)。 */
export const CONCEPT_SHEET_ALTERS = [
  'ALTER TABLE concept_sheets ADD COLUMN auto_update INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE concept_sheets ADD COLUMN latest_rv INTEGER NOT NULL DEFAULT 1',
];
/**
 * 版を持たない既存の行を、その内容のまま rv1 として写す (migration 021 と同じ)。冪等: 版のある行は写さない。
 * 列の追加 (CONCEPT_SHEET_ALTERS) の後に流す。
 */
export const CONCEPT_SHEET_BACKFILLS = [
  `INSERT INTO concept_sheet_versions (sheet_id, rv, project_id, payload, visual_refs, kind, created_by, created_at)
   SELECT s.id, 1, s.project_id, s.payload, '[]', 'migrated', 'migration:021', s.updated_at FROM concept_sheets s
   WHERE NOT EXISTS (SELECT 1 FROM concept_sheet_versions v WHERE v.sheet_id = s.id)`,
];
