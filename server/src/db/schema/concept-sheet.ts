import { pgTable, text, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type { ConceptSheetDocument, ConceptSheetKeyVisual, ConceptSheetSource, ConceptSheetStatus } from '../../../../shared/concept-sheet.ts';
import { projects } from './project.ts';
import { LOCAL_MODE } from '../mode.ts';
import { conceptSheetsSqlite } from '../concept-sheet-sqlite.ts';
/** 1 行 = 企画概要書 1 枚。キービジュアルは生成に使った画像をそのまま持つ (PF-CS-2)。 */
export interface ConceptSheetPayload {
  document: ConceptSheetDocument;
  keyVisual: ConceptSheetKeyVisual | null;
  source: ConceptSheetSource;
  status: ConceptSheetStatus;
}
const conceptSheetsPg = pgTable('concept_sheets', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  payload: jsonb('payload').$type<ConceptSheetPayload>().notNull(), revision: integer('revision').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, t => ({ project: index('idx_concept_sheets_project').on(t.projectId) }));
export const conceptSheets = LOCAL_MODE ? conceptSheetsSqlite as unknown as typeof conceptSheetsPg : conceptSheetsPg;
