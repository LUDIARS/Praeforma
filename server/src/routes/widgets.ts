// /api/projects/:pid/layouts/:lid/widgets — UI 要素の仮置き (feature/screen-flow.md §3.1)。
// object + object_attrs (widget/label/action) + layout_objects を 1 回で作る。 提案反映と同じ経路。
//
// @spec 3.1 UI 要素

import { Hono } from 'hono';
import { z } from 'zod';
import { getDbState } from '../db/connection.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { recordAudit } from '../lib/audit.ts';
import { applyObject } from '../lib/apply-proposals.ts';

const EDIT_ROLES: readonly ProjectRole[] = ['owner', 'planner'];

export const WIDGETS = ['button', 'label', 'list', 'input', 'image', 'tab', 'modal', 'custom'] as const;
export const ACTIONS = ['navigate', 'submit', 'toggle', 'none'] as const;

const createSchema = z.object({
  widget: z.enum(WIDGETS),
  label: z.string().min(1).max(200),
  action: z.enum(ACTIONS).default('none'),
});

export function makeWidgetRouter(): Hono {
  const r = new Hono();

  r.post('/', requireAuth, requireRole(EDIT_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const lid = c.req.param('lid')!;
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
    const placementId = await applyObject(pid, { kind: 'object', layout_id: lid, ...parsed.data });
    await recordAudit({
      projectId: pid,
      actor: getIdentity(c),
      action: 'widget.create',
      targetKind: 'layout_object',
      targetId: placementId,
      meta: { layout_id: lid, ...parsed.data },
    });
    return c.json({ placement_id: placementId }, 201);
  });

  return r;
}
