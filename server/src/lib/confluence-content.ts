import { buildConfluenceRequest } from './confluence-request.ts';

export interface ReferenceContentResult { ok: boolean; markdown?: string; title?: string; errorMessage?: string }
export interface ConfluenceCredentials { origin?: string; user?: string; token?: string }

export async function fetchConfluence(
  url: string,
  config: ConfluenceCredentials = { origin: process.env.CONFLUENCE_ORIGIN, user: process.env.CONFLUENCE_USER, token: process.env.CONFLUENCE_TOKEN },
  fetchImpl: typeof fetch = fetch,
): Promise<ReferenceContentResult> {
  if (!config.origin || !config.user || !config.token) return { ok: false, errorMessage: 'confluence_unconfigured' };
  const request = buildConfluenceRequest(url, config.origin);
  try {
    const response = await fetchImpl(request.url, {
      redirect: request.redirect, signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Basic ${Buffer.from(`${config.user}:${config.token}`).toString('base64')}`, Accept: 'application/json' },
    });
    if (!response.ok) return { ok: false, errorMessage: `Confluence API ${response.status}` };
    const body = await response.json() as { title?: string; body?: { storage?: { value?: string } } };
    const markdown = (body.body?.storage?.value ?? '').replace(/<\/p>/g, '\n').replace(/<br[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    return { ok: true, markdown, title: body.title ?? 'Confluence page' };
  } catch { return { ok: false, errorMessage: 'confluence_fetch_failed' }; }
}
