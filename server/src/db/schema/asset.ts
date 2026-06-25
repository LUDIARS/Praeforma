// assets + object_assets — spec/schema/asset.md

import {
  bigint,
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { projects } from './project.ts';
import { objects } from './object.ts';
import { LOCAL_MODE } from '../mode.ts';
import { assets as assetsSqlite, objectAssets as objectAssetsSqlite } from '../sqlite-schema.ts';

const assetsPg = pgTable(
  'assets',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    mimeType: text('mime_type'),
    storageUrl: text('storage_url').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    checksumSha256: text('checksum_sha256'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    uploadedBy: text('uploaded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    idxProject: index('idx_assets_project').on(t.projectId),
    idxKind: index('idx_assets_kind').on(t.projectId, t.kind),
  }),
);

const objectAssetsPg = pgTable(
  'object_assets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    objectId: text('object_id')
      .notNull()
      .references(() => objects.id),
    platform: text('platform').notNull(),
    assetId: text('asset_id')
      .notNull()
      .references(() => assets.id),
    transformOverride: jsonb('transform_override').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqObjectPlatform: uniqueIndex('uq_object_assets_object_platform').on(
      t.objectId,
      t.platform,
    ),
    idxObject: index('idx_object_assets_object').on(t.objectId),
    idxAsset: index('idx_object_assets_asset').on(t.assetId),
  }),
);

export const assets = LOCAL_MODE
  ? (assetsSqlite as unknown as typeof assetsPg)
  : assetsPg;
export const objectAssets = LOCAL_MODE
  ? (objectAssetsSqlite as unknown as typeof objectAssetsPg)
  : objectAssetsPg;
