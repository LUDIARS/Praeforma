import { z } from 'zod';
import { AppError } from './errors.ts';
import { ANATOMIA_REPO_PATTERN } from './anatomia-domains.ts';
import type { AnatomiaGraphOptions } from './anatomia-graph/client.ts';

const organizationSchema = z.object({
  knowledgeHead: z.string().nullable(),
  domains: z.array(z.object({ id: z.string(), name: z.string(), purpose: z.string(), implementationStatus: z.enum(['implemented', 'missing']) })),
  unassignedCodeSymbols: z.array(z.object({
    id: z.string(), qualifiedName: z.string(), sourcePath: z.string(),
    sourceRange: z.object({ startLine: z.number(), endLine: z.number() }).optional(),
  })),
});

interface DefinitionTodo {
  ref: string;
  kind: 'unassigned-code' | 'missing-purpose' | 'unlinked-domain';
  name: string;
  evidence: string;
}

/** Read Anatomia evidence; writing UX never claims that implementation issues are resolved. */
export async function fetchDefinitionTodos(options: AnatomiaGraphOptions, repo: string): Promise<{ knowledgeHead: string | null; items: DefinitionTodo[] }> {
  if (!options.baseUrl) throw new AppError('anatomia_unconfigured', 503);
  if (!ANATOMIA_REPO_PATTERN.test(repo)) throw AppError.badRequest('bad_anatomia_repo');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${options.baseUrl.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(repo)}/domain-organization`, {
      headers: options.token ? { authorization: `Bearer ${options.token}`, accept: 'application/json' } : { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new AppError('anatomia_upstream_failed', 502, { status: response.status });
    const parsed = organizationSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new AppError('anatomia_bad_payload', 502);
    const { knowledgeHead, domains, unassignedCodeSymbols } = parsed.data;
    const ref = (kind: string, id: string): string => `anatomia:${encodeURIComponent(repo)}:${kind}:${encodeURIComponent(id)}`;
    const items: DefinitionTodo[] = unassignedCodeSymbols.map((symbol) => ({
      ref: ref('code', symbol.id), kind: 'unassigned-code', name: symbol.qualifiedName,
      evidence: `${symbol.sourcePath}${symbol.sourceRange ? `:${symbol.sourceRange.startLine}` : ''}`,
    }));
    for (const domain of domains) {
      if (!domain.purpose.trim()) items.push({ ref: ref('purpose', domain.id), kind: 'missing-purpose', name: domain.name, evidence: 'Anatomia のドメイン目的が未定義' });
      if (domain.implementationStatus === 'missing') items.push({ ref: ref('implementation', domain.id), kind: 'unlinked-domain', name: domain.name, evidence: 'Anatomia に実装の対応付けがない（呼び出しの未配線とは別）' });
    }
    return { knowledgeHead, items: items.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.ref.localeCompare(b.ref)) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    // 原因は server ログにだけ残す。 detail は client へそのまま返るため、
    // 内部 Anatomia URL を含む fetch の error message を載せない。
    console.error(`[ux-definition-todos] anatomia unreachable: ${String(error)}`);
    throw new AppError('anatomia_unreachable', 502);
  } finally { clearTimeout(timer); }
}
