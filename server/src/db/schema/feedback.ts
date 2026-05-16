// object_feedback + feedback_comments — spec/schema/feedback.md
//
// Melpomene 互換のシーン FB。 layout_object_id を主参照とし、
// world_position / screen_position / scene_path で補助情報を持つ。

import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { layouts, layoutObjects } from './layout.ts';
import { objects } from './object.ts';

export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackCategory =
  | 'bug'
  | 'feature'
  | 'improvement'
  | 'question'
  | 'spec-clarification';
export type FeedbackState = 'open' | 'in-progress' | 'resolved' | 'wont-fix';

export const objectFeedback = pgTable(
  'object_feedback',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    layoutId: text('layout_id').references(() => layouts.id),
    objectId: text('object_id').references(() => objects.id),
    layoutObjectId: text('layout_object_id').references(() => layoutObjects.id),
    scenePath: text('scene_path'),
    worldPosition: jsonb('world_position').$type<number[]>(),
    screenPosition: jsonb('screen_position').$type<number[]>(),
    title: text('title').notNull(),
    body: text('body'),
    priority: text('priority').notNull().default('medium'),
    category: text('category').notNull().default('question'),
    state: text('state').notNull().default('open'),
    labels: jsonb('labels').$type<string[]>().notNull().default([]),
    assigneeUserId: text('assignee_user_id'),
    githubIssueNumber: text('github_issue_number'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    idxProject: index('idx_object_feedback_project').on(t.projectId, t.state),
    idxLayout: index('idx_object_feedback_layout').on(t.layoutId, t.state),
    idxObject: index('idx_object_feedback_object').on(t.objectId),
    idxLayoutObject: index('idx_object_feedback_layout_object').on(t.layoutObjectId),
  }),
);

export const feedbackComments = pgTable(
  'feedback_comments',
  {
    id: text('id').primaryKey(),
    feedbackId: text('feedback_id')
      .notNull()
      .references(() => objectFeedback.id),
    userId: text('user_id').notNull(),
    displayName: text('display_name'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idxFeedback: index('idx_feedback_comments_feedback').on(t.feedbackId, t.createdAt),
  }),
);
