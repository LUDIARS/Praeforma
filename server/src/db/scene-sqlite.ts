import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { SceneDocument } from '../../../shared/scene-editor.ts';
export const sceneDocumentsSqlite = sqliteTable('scene_documents', {
  layoutId: text('layout_id').primaryKey(), projectId: text('project_id').notNull(),
  payload: text('payload', { mode: 'json' }).$type<SceneDocument>().notNull(),
  revision: integer('revision').notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const SCENE_DDL = [
  'CREATE TABLE IF NOT EXISTS scene_documents (layout_id TEXT PRIMARY KEY REFERENCES layouts(id), project_id TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
];
