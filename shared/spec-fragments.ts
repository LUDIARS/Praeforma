/** Fragment storage contract; independent of approval and reconstruction state. */
import type { FragmentDisposition } from './spec-versioning.ts';
export type ImplementationState = 'unverified' | 'unimplemented' | 'implemented';

export interface SpecFragment {
  id: string;
  projectId: string;
  content: string;
  source: string;
  sourceEventId: string;
  createdBy: string;
  createdAt: string;
  implementationState: ImplementationState;
  implementationEvidence: string;
  implementationUpdatedBy: string | null;
  implementationUpdatedAt: string | null;
  revision: number;
  /** 再構築での処理結果 (未処理 / 統合 / 棄却)。一覧の応答でのみ付く。 */
  disposition?: FragmentDisposition;
}

export interface FragmentInput {
  content: string;
  sourceEventId: string;
}
