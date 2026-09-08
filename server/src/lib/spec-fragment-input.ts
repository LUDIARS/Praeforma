/** Validate fragment input without normalizing away the original text. */
import { z } from 'zod';

export const createFragmentSchema = z.object({
  content: z.string().min(1).max(20000).refine((value) => value.trim().length > 0),
  sourceEventId: z.string().uuid(),
}).strict();

export const fragmentImplementationSchema = z.object({
  expectedRevision: z.number().int().positive(),
  implementationState: z.enum(['unverified', 'unimplemented', 'implemented']),
  implementationEvidence: z.string().max(4000),
}).strict().refine((value) => value.implementationState !== 'implemented' || value.implementationEvidence.trim().length > 0,
  { message: '実装済には確認根拠を入力してください。', path: ['implementationEvidence'] });
