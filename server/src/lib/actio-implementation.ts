import { z } from 'zod';
import { loadConfig } from '../config.ts';
import type { OverlayImplementation } from '../../../shared/review-overlay.ts';

const reviewSchema = z.object({ kind: z.enum(['spec', 'scenario']), id: z.string(), title: z.string(), specificationRevision: z.string(),
  state: z.enum(['unregistered', 'in_progress', 'returned', 'specification_changed', 'awaiting_confirmation', 'completed']),
  tasks: z.array(z.object({ id: z.string(), title: z.string(), status: z.string(), isBacklog: z.boolean() })),
  confirmation: z.object({ actorId: z.string(), confirmedAt: z.string(), note: z.string() }).nullable(),
});

/** The configured service authenticates the caller again against Actio's team membership. */
export async function readActioImplementation(projectId: string, teamId: string, userId: string): Promise<OverlayImplementation> {
  const { actioUrl, actioClientId, actioClientSecret } = loadConfig();
  if (!actioUrl || !actioClientId || !actioClientSecret) return { state: 'unavailable', message: 'Actio 連携未設定（PRAEFORMA_ACTIO_URL / CLIENT_ID / CLIENT_SECRET）', items: [] };
  try {
    const base = new URL(actioUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('invalid configuration');
    const response = await fetch(`${actioUrl.replace(/\/$/, '')}/api/teams/${encodeURIComponent(teamId)}/planning/praeforma/projects/${encodeURIComponent(projectId)}/implementation/service`, {
      headers: { 'X-API-Client-ID': actioClientId, 'X-API-Client-Secret': actioClientSecret, 'X-Decided-By': userId }, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { state: 'unavailable', message: `Actio の実装状況を取得できません（HTTP ${response.status}）。接続・チーム権限を確認してください。`, items: [] };
    const result = z.object({ projectId: z.literal(projectId), items: z.array(reviewSchema) }).parse(await response.json());
    return { state: 'available', message: 'Actio のタスク／バックログと人間確認に基づく実装状況', items: result.items };
  } catch {
    return { state: 'unavailable', message: 'Actio の実装状況を確認できません。接続設定・応答を確認してください。', items: [] };
  }
}
