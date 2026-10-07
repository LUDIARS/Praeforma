import { AppError } from './errors.ts';
import { contract } from '@ludiars/log-weaver'; /* augur-inject:import:73b9e197 */
import augurContract_51e09353 from '../../contracts/confluence-request.contract.ts'; /* augur-inject:contract-predicate:e8d09a3a */

/** Credentials are attached only after both the administrator origin and document URL pass. */
export function buildConfluenceRequest(url: string, origin: string): { url: string; redirect: 'error' } {
  let trusted: URL;
  let document: URL;
  try { trusted = new URL(origin); document = new URL(url); }
  catch { throw AppError.badRequest('confluence_origin_invalid'); }
  if (trusted.protocol !== 'https:' || trusted.username || trusted.password
    || trusted.pathname !== '/' || trusted.search || trusted.hash) {
    throw AppError.badRequest('confluence_origin_invalid');
  }
  if (document.origin !== trusted.origin || document.username || document.password) {
    throw AppError.forbidden('confluence_origin_not_allowed');
  }
  const pageId = document.pathname.match(/\/pages\/(\d+)(?:\/|$)/)?.[1] ?? document.searchParams.get('pageId');
  if (!pageId || !/^\d+$/.test(pageId)) throw AppError.badRequest('confluence_page_id_required');
  return { url: `${trusted.origin}/wiki/rest/api/content/${pageId}?expand=body.storage`, redirect: 'error' };
}
// @ts-expect-error augur-inject
buildConfluenceRequest = contract(buildConfluenceRequest, { ...augurContract_51e09353, contractId: 'C-5', mode: 'observe', sample: 1, where: 'server/src/lib/confluence-request.ts:4', rule: 'contract-wrap', id: '51e09353' }); /* augur-inject:contract-wrap:51e09353 */
