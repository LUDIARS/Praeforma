/** 再構築での処理結果 (未処理 / 統合 / 棄却) を断片一覧に付ける。 */
import type { FragmentDisposition } from '../../../shared/spec-versioning.ts';
import { versionRows } from '../db/spec-version-store.ts';

export async function fragmentDispositions(fragmentIds: readonly string[]): Promise<Map<string, FragmentDisposition>> {
  const result = new Map<string, FragmentDisposition>();
  if (!fragmentIds.length) return result;
  const rows = await versionRows(`SELECT r.fragment_id,r.disposition,r.reason,s.confirmed_version FROM spec_reconstruction_fragments r
    JOIN spec_reconstructions s ON s.id=r.reconstruction_id WHERE r.fragment_id IN (${fragmentIds.map(() => '?').join(',')})`, [...fragmentIds]);
  for (const row of rows) {
    result.set(String(row.fragment_id), {
      state: row.disposition === 'rejected' ? 'rejected' : 'integrated',
      reason: row.reason === null || row.reason === undefined ? null : String(row.reason),
      version: row.confirmed_version === null || row.confirmed_version === undefined ? null : String(row.confirmed_version),
    });
  }
  return result;
}

export const PENDING_DISPOSITION: FragmentDisposition = { state: 'pending', reason: null, version: null };
