import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { SceneImageType } from '../../../shared/concept-sheet.ts';
import type { VisualKind } from '../../../shared/project-visual.ts';
export const projectVisualsSqlite = sqliteTable('project_visuals', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(),
  kind: text('kind').$type<VisualKind>().notNull(), label: text('label').notNull(), note: text('note').notNull().default(''),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  mimeType: text('mime_type').$type<SceneImageType>().notNull(), byteSize: integer('byte_size').notNull(),
  digest: text('digest').notNull(), dataUrl: text('data_url').notNull(),
  revision: integer('revision').notNull().default(1), createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});
export const PROJECT_VISUAL_DDL = [
  'CREATE TABLE IF NOT EXISTS project_visuals (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL, label TEXT NOT NULL, note TEXT NOT NULL DEFAULT \'\', featured INTEGER NOT NULL DEFAULT 0, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, digest TEXT NOT NULL, data_url TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER)',
  'CREATE INDEX IF NOT EXISTS idx_project_visuals_project ON project_visuals(project_id)',
];
