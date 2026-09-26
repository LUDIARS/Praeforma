import { pgTable, text, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { ConceptSheetDesign, ConceptSheetImage, ConceptSheetSource } from '../../../../shared/concept-sheet.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { conceptSheetsSqlite } from '../concept-sheet-sqlite.ts';
/**
 * 1 行 = 企画概要書 1 枚。Astra が設計した紙面と、生成に使った画面の候補をそのまま持つ (PF-CS-2 / PF-CS-3)。
 * 2026-09-26 に文面 (document) + キービジュアルの形から、この形へ替えた。旧形式の行は読まない (spec/schema/concept-sheets.md)。
 */
export interface ConceptSheetPayload {
  design: ConceptSheetDesign;
  images: ConceptSheetImage[];
  source: ConceptSheetSource;
}
const conceptSheetsPg = pgTable('concept_sheets', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  payload: jsonb('payload').$type<ConceptSheetPayload>().notNull(), revision: integer('revision').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, t => ({ project: index('idx_concept_sheets_project').on(t.projectId) }));
export const conceptSheets = LOCAL_MODE ? conceptSheetsSqlite as unknown as typeof conceptSheetsPg : conceptSheetsPg;
