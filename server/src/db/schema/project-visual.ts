import { pgTable, text, integer, timestamp, index, boolean } from 'drizzle-orm/pg-core';
import type { SceneImageType } from '../../../../shared/concept-sheet.ts';
import type { VisualKind } from '../../../../shared/project-visual.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { projectVisualsSqlite } from '../project-visual-sqlite.ts';
/**
 * 1 行 = ビジュアル素材 1 枚 (spec/schema/project-visuals.md)。画像は data URL のまま持つ
 * (assets の保存先は仮実装で画像を置けないため、企画概要書と同じく DB に持つ)。画像の中身は作成後に変えない。
 * 版が使ったものは削除しても deleted_at を付けて残す (古い版の紙面から画像が消えないように、PF-VIS-4)。
 */
const projectVisualsPg = pgTable('project_visuals', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  kind: text('kind').$type<VisualKind>().notNull(), label: text('label').notNull(), note: text('note').notNull().default(''),
  featured: boolean('featured').notNull().default(false),
  mimeType: text('mime_type').$type<SceneImageType>().notNull(), byteSize: integer('byte_size').notNull(),
  digest: text('digest').notNull(), dataUrl: text('data_url').notNull(),
  revision: integer('revision').notNull().default(1), createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => ({ project: index('idx_project_visuals_project').on(t.projectId) }));
export const projectVisuals = LOCAL_MODE ? projectVisualsSqlite as unknown as typeof projectVisualsPg : projectVisualsPg;
