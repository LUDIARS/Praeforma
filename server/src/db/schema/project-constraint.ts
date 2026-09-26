import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { ConstraintKind } from '../../../../shared/project-constraint.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { projectConstraintsSqlite } from '../project-constraint-sqlite.ts';
/** 1 行 = 制約 1 件 (spec/schema/project-constraints.md)。版一致で更新・削除する。 */
const projectConstraintsPg = pgTable('project_constraints', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  kind: text('kind').$type<ConstraintKind>().notNull(), title: text('title').notNull(), detail: text('detail').notNull().default(''),
  revision: integer('revision').notNull().default(1), createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ project: index('idx_project_constraints_project').on(t.projectId) }));
export const projectConstraints = LOCAL_MODE ? projectConstraintsSqlite as unknown as typeof projectConstraintsPg : projectConstraintsPg;
