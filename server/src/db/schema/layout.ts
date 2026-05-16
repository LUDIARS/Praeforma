// layouts + layout_objects + cameras — spec/schema/layout.md

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { objects } from './object.ts';

export const layouts = pgTable(
  'layouts',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').notNull().default('world-3d'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxProject: index('idx_layouts_project').on(t.projectId),
  }),
);

export const layoutObjects = pgTable(
  'layout_objects',
  {
    id: text('id').primaryKey(),
    layoutId: text('layout_id')
      .notNull()
      .references(() => layouts.id),
    objectId: text('object_id')
      .notNull()
      .references(() => objects.id),
    position: jsonb('position').$type<number[]>().notNull().default([0, 0, 0]),
    rotation: jsonb('rotation').$type<number[]>().notNull().default([0, 0, 0]),
    scale: jsonb('scale').$type<number[]>().notNull().default([1, 1, 1]),
    parentLayoutObjectId: text('parent_layout_object_id'),
    lockTransform: boolean('lock_transform').notNull().default(false),
    ordinal: integer('ordinal').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqLayoutObject: uniqueIndex('uq_layout_objects_layout_object').on(
      t.layoutId,
      t.objectId,
    ),
    idxLayout: index('idx_layout_objects_layout').on(t.layoutId),
    idxObject: index('idx_layout_objects_object').on(t.objectId),
    idxParent: index('idx_layout_objects_parent').on(t.parentLayoutObjectId),
  }),
);

export const cameras = pgTable(
  'cameras',
  {
    id: text('id').primaryKey(),
    layoutId: text('layout_id')
      .notNull()
      .references(() => layouts.id),
    name: text('name').notNull().default('main'),
    kind: text('kind').notNull().default('perspective'),
    position: jsonb('position').$type<number[]>().notNull().default([0, 5, -10]),
    target: jsonb('target').$type<number[]>().notNull().default([0, 0, 0]),
    up: jsonb('up').$type<number[]>().notNull().default([0, 1, 0]),
    fov: real('fov').default(60.0),
    orthoSize: real('ortho_size').default(10.0),
    near: real('near').notNull().default(0.1),
    far: real('far').notNull().default(1000.0),
    isDefault: boolean('is_default').notNull().default(false),
  },
  (t) => ({
    uniqLayoutName: uniqueIndex('uq_cameras_layout_name').on(t.layoutId, t.name),
    idxLayout: index('idx_cameras_layout').on(t.layoutId),
  }),
);
