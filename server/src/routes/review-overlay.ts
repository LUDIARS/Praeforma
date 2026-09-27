import { Hono } from 'hono';
import { getDbState } from '../db/connection.ts';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { readReviewOverlay } from '../lib/review-overlay-read.ts';
import { reviewOverlayTela } from '../../../shared/review-overlay-tela.ts';
import { implementationManifest } from '../lib/implementation-manifest.ts';
import { readActioImplementation } from '../lib/actio-implementation.ts';

export function makeReviewOverlayRouter(): Hono {
  const router = new Hono();
  router.get('/manifest', requireAuth, requireRole(['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer']), async c => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    return c.json(await implementationManifest(c.req.param('pid')!));
  });
  router.get('/', requireAuth, requireRole(['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer']), async c => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const snapshot = await readReviewOverlay(c.req.param('pid')!, c.req.query('layout_id'));
    const implementation = await readActioImplementation(snapshot.projectId, snapshot.teamId, getIdentity(c).userId);
    snapshot.implementation = { ...implementation, items: implementation.items.filter(item => item.kind === 'spec'
      ? snapshot.specs.some(spec => spec.id === item.id) : snapshot.scenarios.some(scenario => scenario.id === item.id)) };
    if (c.req.query('format') !== 'tela') return c.json(snapshot);
    try { return c.json({ telaDocument: reviewOverlayTela(snapshot, c.req.query('frame_id')), sceneName: snapshot.scene?.name ?? snapshot.projectName }); }
    catch (error) { throw AppError.badRequest(error instanceof Error ? error.message : 'invalid_overlay'); }
  });
  return router;
}
