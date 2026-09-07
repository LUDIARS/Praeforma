import { AppError } from './errors.ts';
import type { AnatomiaGraphOptions } from './anatomia-graph/client.ts';
import { ANATOMIA_REPO_PATTERN } from './anatomia-domains.ts';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface AnatomiaDomainSummary {
  id: string;
  name: string;
  purpose: string;
  implementationStatus: 'implemented' | 'missing';
}

export interface AnatomiaDomainOrganization {
  knowledgeHead: string | null;
  domains: AnatomiaDomainSummary[];
}

export async function fetchDomainOrganization(
  options: AnatomiaGraphOptions,
  project: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<AnatomiaDomainOrganization> {
  if (!options.baseUrl) throw new AppError('anatomia_unconfigured', 503);
  if (!ANATOMIA_REPO_PATTERN.test(project)) throw AppError.badRequest('bad_anatomia_repo');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(
      `${options.baseUrl.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(project)}/domain-organization`,
      {
        headers: options.token
          ? { accept: 'application/json', authorization: `Bearer ${options.token}` }
          : { accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new AppError('anatomia_upstream_failed', 502, { status: response.status });
    const value = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!value || !Array.isArray(value.domains)) throw new AppError('anatomia_bad_payload', 502);
    const domains = value.domains.map((entry): AnatomiaDomainSummary => {
      if (!entry || typeof entry !== 'object') throw new AppError('anatomia_bad_payload', 502);
      const domain = entry as Record<string, unknown>;
      if (typeof domain.id !== 'string' || typeof domain.name !== 'string') {
        throw new AppError('anatomia_bad_payload', 502);
      }
      if (domain.implementationStatus !== 'implemented' && domain.implementationStatus !== 'missing') {
        throw new AppError('anatomia_bad_payload', 502);
      }
      return {
        id: domain.id,
        name: domain.name,
        purpose: typeof domain.purpose === 'string' ? domain.purpose : '',
        implementationStatus: domain.implementationStatus,
      };
    });
    return {
      knowledgeHead: typeof value.knowledgeHead === 'string' ? value.knowledgeHead : null,
      domains,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('anatomia_unreachable', 502, { reason: String(error) });
  } finally {
    clearTimeout(timer);
  }
}
