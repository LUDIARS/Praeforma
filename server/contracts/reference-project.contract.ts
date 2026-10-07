import type { referenceBelongsToProject } from '../src/lib/reference-access.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (result, reference, projectId) => result === Boolean(reference && reference.projectId === projectId),
} satisfies ContractOf<typeof referenceBelongsToProject>;
