import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { requireAuth, getIdentity } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { versionRows } from '../db/spec-version-store.ts';
import { AppError } from '../lib/errors.ts';
import { LlmChatService } from '../lib/llm-chat-service.ts';
import { CliConsultationRunner } from '../lib/consultation-runner.ts';

export function makeLlmChatRouter(options: { claudeBin: string }): Hono {
  const r = new Hono();
  const service = new LlmChatService(new CliConsultationRunner(options.claudeBin));
  r.use('*', requireAuth, requireRole(['owner', 'planner']), bodyLimit({ maxSize: 32768 }));
  r.use('*', async (c, next) => {
    if (!(await versionRows('SELECT id FROM projects WHERE id=? AND deleted_at IS NULL', [c.req.param('pid')!])).length) {
      throw AppError.notFound('project_not_found');
    }
    await next();
  });
  r.get('/', async c => c.json(await service.view(c.req.param('pid')!, getIdentity(c).userId)));
  r.post('/messages', async c => {
    const parsed = z.object({ text: z.string().trim().min(1).max(8000) }).strict().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw AppError.badRequest('chat_text_required');
    await service.send(c.req.param('pid')!, getIdentity(c).userId, parsed.data.text);
    return c.json({ ok: true });
  });
  r.post('/resume', async c => { await service.resume(c.req.param('pid')!, getIdentity(c).userId); return c.json({ ok: true }); });
  r.post('/clear', async c => { await service.clear(c.req.param('pid')!, getIdentity(c).userId); return c.json({ ok: true }); });
  return r;
}
