// references — spec/schema/reference.md
//
// ドメイン (および project / object / spec) に対する外部 doc リンク。
// v0.1 は display_mode='link' のみ実装、 webview / markdown は v0.2+。

import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './project.ts';

export type ReferenceTargetKind = 'domain' | 'project' | 'object' | 'spec';
export type ReferenceKind =
  | 'notion'
  | 'confluence'
  | 'google-docs'
  | 'google-sheet'
  | 'web'
  | 'figma'
  | 'github';
export type ReferenceDisplayMode = 'link' | 'webview' | 'markdown';

// `references` は SQL 予約語なので DB 上は external_references。
// 変数名 references は keep (spec / UI と合わせる)。
export const references = pgTable(
  'external_references',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    kind: text('kind').notNull().default('web'),
    url: text('url').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    displayMode: text('display_mode').notNull().default('link'),
    ordinal: integer('ordinal').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxTarget: index('idx_external_references_target').on(t.targetKind, t.targetId),
    idxProject: index('idx_external_references_project').on(t.projectId),
  }),
);

/** URL ホスト名から kind を推定 (UI 入力時の defaulting に使う、 server でも自動補正)。 */
export function inferReferenceKind(url: string): ReferenceKind {
  const u = url.toLowerCase();
  if (u.includes('notion.so') || u.includes('notion.site')) return 'notion';
  if (u.includes('atlassian.net/wiki') || u.includes('confluence'))
    return 'confluence';
  if (u.includes('docs.google.com/spreadsheet')) return 'google-sheet';
  if (u.includes('docs.google.com/document')) return 'google-docs';
  if (u.includes('figma.com')) return 'figma';
  if (u.includes('github.com')) return 'github';
  return 'web';
}
