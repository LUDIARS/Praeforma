import { pgTable, text, jsonb, integer, timestamp, index, boolean, primaryKey } from 'drizzle-orm/pg-core';
import type {
  ConceptSheetDesign, ConceptSheetImage, ConceptSheetSource, ConceptSheetVersionKind, ConceptSheetVisualRef,
} from '../../../../shared/concept-sheet.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { conceptSheetsSqlite, conceptSheetVersionsSqlite } from '../concept-sheet-sqlite.ts';
/**
 * 1 行 = 企画概要書 1 枚の最新版 (一覧・版一致・自動更新の ON/OFF)。版の履歴は concept_sheet_versions (PF-CS-10)。
 * 2026-09-26 に文面 (document) + キービジュアルの形から design の形へ替えた。旧形式の行は読まない (spec/schema/concept-sheets.md)。
 * migration 021 より後に書いた行は画像を持たず、使ったビジュアルを visualRefs で指す。それより前の行は images を持つ。
 */
export interface ConceptSheetPayload {
  design: ConceptSheetDesign;
  source: ConceptSheetSource;
  visualRefs?: ConceptSheetVisualRef[];
  images?: ConceptSheetImage[];
}
/** 1 つの版の紙面と出典。images は migration 021 で写した rv1 だけが持つ (それ以外はビジュアルを visual_refs で指す)。 */
export interface ConceptSheetVersionPayload {
  design: ConceptSheetDesign;
  source: ConceptSheetSource;
  images?: ConceptSheetImage[];
}
const conceptSheetsPg = pgTable('concept_sheets', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  payload: jsonb('payload').$type<ConceptSheetPayload>().notNull(), revision: integer('revision').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  autoUpdate: boolean('auto_update').notNull().default(true), latestRv: integer('latest_rv').notNull().default(1),
}, t => ({ project: index('idx_concept_sheets_project').on(t.projectId) }));
const conceptSheetVersionsPg = pgTable('concept_sheet_versions', {
  sheetId: text('sheet_id').notNull().references(() => conceptSheetsPg.id, { onDelete: 'cascade' }),
  rv: integer('rv').notNull(), projectId: text('project_id').notNull().references(() => projects.id),
  payload: jsonb('payload').$type<ConceptSheetVersionPayload>().notNull(),
  visualRefs: jsonb('visual_refs').$type<ConceptSheetVisualRef[]>().notNull().default([]),
  kind: text('kind').$type<ConceptSheetVersionKind>().notNull(), createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ pk: primaryKey({ columns: [t.sheetId, t.rv] }), project: index('idx_concept_sheet_versions_project').on(t.projectId) }));
export const conceptSheets = LOCAL_MODE ? conceptSheetsSqlite as unknown as typeof conceptSheetsPg : conceptSheetsPg;
export const conceptSheetVersions = LOCAL_MODE
  ? conceptSheetVersionsSqlite as unknown as typeof conceptSheetVersionsPg : conceptSheetVersionsPg;
