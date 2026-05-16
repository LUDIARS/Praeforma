// objects + object_attrs — spec/schema/object.md

import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { domains } from './domain.ts';

export const objects = pgTable(
  'objects',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id),
    label: text('label').notNull(),
    placeholderShape: text('placeholder_shape').notNull().default('cube'),
    placeholderColor: text('placeholder_color').notNull().default('#888888'),
    placeholderImageAssetId: text('placeholder_image_asset_id'),
    parentObjectId: text('parent_object_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxProject: index('idx_objects_project').on(t.projectId),
    idxDomain: index('idx_objects_domain').on(t.domainId),
    idxParent: index('idx_objects_parent').on(t.parentObjectId),
  }),
);

export const objectAttrs = pgTable(
  'object_attrs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    objectId: text('object_id')
      .notNull()
      .references(() => objects.id),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    inheritedFrom: text('inherited_from'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqObjectKey: uniqueIndex('uq_object_attrs_object_key').on(t.objectId, t.key),
    idxObject: index('idx_object_attrs_object').on(t.objectId),
    idxKey: index('idx_object_attrs_key').on(t.key),
  }),
);
