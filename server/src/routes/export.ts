// /api/projects/:pid/export — 遷移図 (flow.mmd) と仕様書 (spec.md) の生成 (feature/screen-flow.md §7)。
// 決定的: 同じ DB 状態なら同じ出力。 LLM は使わない。
//
// @spec 7. 生成物の形式

import { Hono } from 'hono';
import { getDbState } from '../db/connection.ts';
import { type ProjectRole } from '../db/schema/project.ts';
import { requireAuth } from '../middleware/require-auth.ts';
import { requireRole } from '../middleware/require-role.ts';
import { AppError } from '../lib/errors.ts';
import { loadExportModel } from '../lib/export/load-model.ts';
import { renderFlowMermaid } from '../lib/export/flow-mermaid.ts';
import { renderSpecMarkdown } from '../lib/export/spec-markdown.ts';

const ALL_ROLES: readonly ProjectRole[] = ['owner', 'planner', 'designer', 'programmer', 'reviewer', 'viewer'];

export function makeExportRouter(): Hono {
  const r = new Hono();

  r.get('/flow.mmd', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const group = c.req.query('group') === 'domain' ? 'domain' : 'none';
    const direction = c.req.query('direction') === 'TB' ? 'TB' : 'LR';
    const model = await loadExportModel(pid);
    const text = renderFlowMermaid(model, { groupBy: group, direction });
    c.header('content-type', 'text/vnd.mermaid; charset=utf-8');
    if (c.req.query('download') === '1') c.header('content-disposition', 'attachment; filename="flow.mmd"');
    return c.body(text);
  });

  // UI 用の読み取りモデル (画面 / UI 要素 / 遷移 / ドメイン / cc_links を 1 回で)
  r.get('/model.json', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    return c.json(await loadExportModel(pid));
  });

  r.get('/spec.md', requireAuth, requireRole(ALL_ROLES), async (c) => {
    if (!getDbState().ok) throw AppError.internal('db_unavailable');
    const pid = c.req.param('pid')!;
    const model = await loadExportModel(pid);
    const text = renderSpecMarkdown(model);
    c.header('content-type', 'text/markdown; charset=utf-8');
    if (c.req.query('download') === '1') c.header('content-disposition', 'attachment; filename="spec.md"');
    return c.body(text);
  });

  return r;
}
