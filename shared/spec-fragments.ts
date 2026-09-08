/** Fragment storage contract; independent of approval and reconstruction state. */
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
}

export interface FragmentInput {
  content: string;
  sourceEventId: string;
}
