// /api/projects/:pid/domains — CRUD + 継承解決。
//
// role:
//   - list / get: viewer 以上
//   - create / update / delete: owner / planner

import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { getDb, getDbState } from '../db/connection.ts';
import { domains, type RequiredAttr } from '../db/schema/domain.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';

const ALL_ROLES: readonly ProjectRole[] = [
  'owner',
  'planner',
  'designer',
  'programmer',
  'reviewer',
  'viewer',
];
const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

const requiredAttrSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'enum']),
  default: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(80).nullish(),
  parent_id: z.string().nullish(),
  max_count: z.number().int().positive().nullish(),
  required_attrs: z.array(requiredAttrSchema).optional(),
});

const updateSchema = createSchema.partial();

/** 親をたどって required_attrs をマージ (子が上書き)。 循環は防御的に depth で打切る。 */
async function resolveInheritedAttrs(domainId: string): Promise<RequiredAttr[]> {
  const seen = new Set<string>();
  const chain: RequiredAttr[][] = [];
  let cursor: string | null = domainId;
  while (cursor && !seen.has(cursor) && chain.length < 16) {
    seen.add(cursor);
    const [row] = await getDb().select().from(domains).where(eq(domains.id, cursor)).limit(1);
    if (!row) break;
    chain.push(row.requiredAttrs);
    cursor = row.parentId;
  }
  // chain[0] が自分、 chain[N] がルート。 マージは root → self で子が上書き
  const merged = new Map<string, RequiredAttr>();
  for (let i = chain.length - 1; i >= 0; i--) {
    for (const attr of chain[i] ?? []) merged.set(attr.name, attr);
  }
  return Array.from(merged.values());
}

export function makeDomainRouter(): Hono {
  const r = new Hono();

  r.get('/', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const items = await getDb()
      .select()
      .from(domains)
      .where(eq(domains.projectId, pid))
      .orderBy(asc(domains.name));
    return c.json({ items });
  });

  r.get('/:did', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const did = c.req.param('did')!;
    const [row] = await getDb().select().from(domains).where(eq(domains.id, did)).limit(1);
    if (!row) throw AppError.notFound();
    const resolved = await resolveInheritedAttrs(did);
    return c.json({ domain: row, resolved_required_attrs: resolved });
  });

  r.post('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    // project 内で name unique は DB UNIQUE で担保するが、 事前 lookup でわかりやすい error
    const existing = await getDb()
      .select()
      .from(domains)
      .where(and(eq(domains.projectId, pid), eq(domains.name, parsed.data.name)))
      .limit(1);
    if (existing.length > 0) throw AppError.conflict('domain_name_exists');

    const did = ulid();
    await getDb()
      .insert(domains)
      .values({
        id: did,
        projectId: pid,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        color: parsed.data.color ?? '#888888',
        icon: parsed.data.icon ?? null,
        parentId: parsed.data.parent_id ?? null,
        maxCount: parsed.data.max_count ?? null,
        requiredAttrs: parsed.data.required_attrs ?? [],
      });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'domain.create',
      targetKind: 'domain',
      targetId: did,
      meta: { name: parsed.data.name },
    });
    const [row] = await getDb().select().from(domains).where(eq(domains.id, did)).limit(1);
    return c.json({ domain: row }, 201);
  });

  r.patch('/:did', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const did = c.req.param('did')!;
    const body = await c.req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.color !== undefined) patch.color = parsed.data.color;
    if (parsed.data.icon !== undefined) patch.icon = parsed.data.icon;
    if (parsed.data.parent_id !== undefined) patch.parentId = parsed.data.parent_id;
    if (parsed.data.max_count !== undefined) patch.maxCount = parsed.data.max_count;
    if (parsed.data.required_attrs !== undefined) patch.requiredAttrs = parsed.data.required_attrs;

    await getDb().update(domains).set(patch).where(eq(domains.id, did));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'domain.update',
      targetKind: 'domain',
      targetId: did,
      meta: parsed.data,
    });
    const [row] = await getDb().select().from(domains).where(eq(domains.id, did)).limit(1);
    if (!row) throw AppError.notFound();
    return c.json({ domain: row });
  });

  r.delete('/:did', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const did = c.req.param('did')!;
    await getDb().delete(domains).where(eq(domains.id, did));
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'domain.delete',
      targetKind: 'domain',
      targetId: did,
    });
    return c.json({ ok: true });
  });

  return r;
}
