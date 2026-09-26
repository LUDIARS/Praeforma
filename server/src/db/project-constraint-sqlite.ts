import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { ConstraintKind } from '../../../shared/project-constraint.ts';
export const projectConstraintsSqlite = sqliteTable('project_constraints', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(),
  kind: text('kind').$type<ConstraintKind>().notNull(), title: text('title').notNull(), detail: text('detail').notNull().default(''),
  revision: integer('revision').notNull().default(1), createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(), updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const PROJECT_CONSTRAINT_DDL = [
  'CREATE TABLE IF NOT EXISTS project_constraints (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT \'\', revision INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_project_constraints_project ON project_constraints(project_id)',
];
