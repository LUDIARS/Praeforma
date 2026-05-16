// /api/projects/:pid/assets — asset CRUD + pre-signed URL + object_assets link。

import { Hono } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { assets, objectAssets } from '../db/schema/asset.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { StubStorageSource } from '../storage/source.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer',
];
const UPLOAD_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer'];

const createSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['image', 'sprite', 'model-3d', 'unity-prefab', 'particle', 'other']),
  mime_type: z.string().max(200).nullish(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(200),
});

const linkSchema = z.object({
  object_id: z.string().min(1),
  platform: z.enum(['web', 'webgl', 'unity', '2d-web']),
  asset_id: z.string().min(1),
  transform_override: z.record(z.string(), z.unknown()).nullish(),
});

export function makeAssetRouter(publicUrl: string): Hono {
  const storage = new StubStorageSource(publicUrl);
  const r = new Hono();

  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const kind = c.req.query('kind');
    const conds = [eq(assets.projectId, pid), isNull(assets.deletedAt)];
    if (kind) conds.push(eq(assets.kind, kind));
    const items = await getDb()
      .select()
      .from(assets)
      .where(and(...conds))
      .orderBy(asc(assets.name));
    return c.json({ items });
  });

  // create a new asset row (storage_url 未確定の状態で行を立てる)
  r.post('/', requireAuth, requireRole(UPLOAD_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    const aid = ulid();
    const id = getIdentity(c);
    await getDb()
      .insert(assets)
      .values({
        id: aid,
        projectId: pid,
        name: parsed.data.name,
        kind: parsed.data.kind,
        mimeType: parsed.data.mime_type ?? null,
        storageUrl: `pending://${aid}`, // upload 完了後に PATCH で確定
        meta: parsed.data.meta ?? {},
        uploadedBy: id.userId,
      });
    await recordAudit({
      projectId: pid,
      actor: id,
      action: 'asset.create',
      targetKind: 'asset',
      targetId: aid,
      meta: { name: parsed.data.name, kind: parsed.data.kind },
    });
    const [row] = await getDb().select().from(assets).where(eq(assets.id, aid)).limit(1);
    return c.json({ asset: row }, 201);
  });

  // pre-signed URL を発行 → client が直 PUT で storage に上げる
  r.post('/:aid/presign', requireAuth, requireRole(UPLOAD_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const aid = c.req.param('aid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const ps = await storage.presignUpload({
      projectId: pid,
      assetId: aid,
      filename: parsed.data.filename,
      contentType: parsed.data.content_type,
    });
    return c.json(ps);
  });

  // upload 完了通知 (storage_url + checksum などを確定)
  r.patch('/:aid', requireAuth, requireRole(UPLOAD_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const aid = c.req.param('aid')!;
    const body = (await c.req.json().catch(() => null)) as
      | { storage_url?: string; size_bytes?: number; checksum_sha256?: string }
      | null;
    if (!body || !body.storage_url) throw AppError.badRequest('storage_url_required');
    await getDb()
      .update(assets)
      .set({
        storageUrl: body.storage_url,
        sizeBytes: body.size_bytes ?? null,
        checksumSha256: body.checksum_sha256 ?? null,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, aid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'asset.finalize',
      targetKind: 'asset',
      targetId: aid,
      meta: { size_bytes: body.size_bytes },
    });
    const [row] = await getDb().select().from(assets).where(eq(assets.id, aid)).limit(1);
    return c.json({ asset: row });
  });

  r.delete('/:aid', requireAuth, requireRole(UPLOAD_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const aid = c.req.param('aid')!;
    await getDb()
      .update(assets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(assets.id, aid));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'asset.delete',
      targetKind: 'asset',
      targetId: aid,
    });
    return c.json({ ok: true });
  });

  // ── object_assets (platform 別紐付け) ──────────────────────────────

  r.put('/links', requireAuth, requireRole(UPLOAD_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    // UNIQUE (object_id, platform) なので削除 → insert
    await getDb()
      .delete(objectAssets)
      .where(and(
        eq(objectAssets.objectId, parsed.data.object_id),
        eq(objectAssets.platform, parsed.data.platform),
      ));
    await getDb()
      .insert(objectAssets)
      .values({
        objectId: parsed.data.object_id,
        platform: parsed.data.platform,
        assetId: parsed.data.asset_id,
        transformOverride: (parsed.data.transform_override as Record<string, unknown>) ?? null,
      });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'object_asset.link',
      targetKind: 'object_asset',
      targetId: `${parsed.data.object_id}:${parsed.data.platform}`,
      meta: { asset_id: parsed.data.asset_id },
    });
    return c.json({ ok: true });
  });

  // upload stub endpoint (= StubStorageSource が発行した URL の受け口)
  r.put('/:aid/upload-stub', requireAuth, requireRole(UPLOAD_ROLES), (c) => {
    // 実 byte は受け取らない (= stub なので metadata だけ進める PATCH を使う)
    return c.json({
      message: 'StubStorageSource: upload はサポートされない。 MinIO/S3 adapter で差し替えてください',
    }, 501);
  });

  return r;
}
