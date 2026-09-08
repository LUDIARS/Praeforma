import { pgTable, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import type { SceneDocument } from '../../../../shared/scene-editor.ts';
import { layouts } from './layout.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { sceneDocumentsSqlite } from '../scene-sqlite.ts';
const sceneDocumentsPg = pgTable('scene_documents', {
  layoutId: text('layout_id').primaryKey().references(() => layouts.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  payload: jsonb('payload').$type<SceneDocument>().notNull(), revision: integer('revision').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
export const sceneDocuments = LOCAL_MODE ? sceneDocumentsSqlite as unknown as typeof sceneDocumentsPg : sceneDocumentsPg;
