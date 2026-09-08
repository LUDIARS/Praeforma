import { z } from 'zod';
export { canvasSchema } from '../../../shared/design-canvas.ts';
import { AppError } from '../lib/errors.ts';

const stringList = z.array(z.string().trim().min(1).max(2000)).max(100).default([]);

export const createScenarioSchema = z.object({
  name: z.string().trim().min(1).max(200),
  actor: z.string().trim().min(1).max(500),
  context: z.string().max(4000).default(''),
  goal: z.string().trim().min(1).max(4000),
  successOutcome: z.string().trim().min(1).max(4000),
  sourceProjectKey: z.string().trim().min(1).max(100).nullish(),
  sourceRefs: z.array(z.string().trim().min(1).max(2000)).max(50).default([]),
}).strict();

export const updateScenarioSchema = createScenarioSchema.partial().extend({
  expectedRevision: z.number().int().positive(),
  status: z.enum(['draft', 'reviewed']).optional(),
}).strict();

export const createUseCaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  userIntent: z.string().trim().min(1).max(4000),
  trigger: z.string().trim().min(1).max(2000),
  preconditions: stringList,
  successOutcome: z.string().trim().min(1).max(4000),
  failureOutcomes: stringList,
  interruptionRecovery: z.string().max(4000).default(''),
  ordinal: z.number().int().min(0).default(0),
}).strict();

export const updateUseCaseSchema = createUseCaseSchema.partial().extend({
  expectedRevision: z.number().int().positive(),
}).strict();

export const analysisSchema = z.object({
  expected_revision: z.number().int().positive(),
  use_case_ids: z.array(z.string().trim().min(1)).max(100).optional(),
  note: z.string().max(8000).nullish(),
  visibility: z.enum(['public', 'sensitive']).default('sensitive'),
}).strict();

const boundarySchema = z.object({
  name: z.string().trim().min(1).max(200),
  responsibility: z.string().trim().min(1).max(4000),
  classification: z.enum(['core', 'supporting', 'generic']).optional(),
  in_scope: stringList,
  out_of_scope: stringList,
  rules: stringList,
  ubiquitous_language: stringList,
  interactions: stringList,
  use_case_ids: z.array(z.string().trim().min(1)).max(100).default([]),
}).strict();

export const decisionSchema = z.object({
  action: z.enum(['accept', 'reject', 'revise', 'split', 'merge']),
  expected_proposal_revision: z.number().int().positive(),
  rationale: z.string().trim().min(1).max(8000),
  result_boundaries: z.array(boundarySchema).max(20).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.action !== 'reject' && value.result_boundaries.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'result_boundaries_required' });
  }
  if (value.action === 'reject' && value.result_boundaries.length > 0) {
    ctx.addIssue({ code: 'custom', message: 'rejected_boundary_results_forbidden' });
  }
});
export type DecisionInput = z.output<typeof decisionSchema>;

export const evidenceSchema = z.object({
  targetKind: z.enum(['scenario', 'use_case', 'proposal']),
  targetId: z.string().trim().min(1),
  kind: z.enum(['implementation', 'test', 'anatomia', 'manual']),
  sourceProjectKey: z.string().trim().min(1).max(100),
  sourceRevision: z.string().trim().min(1).max(500),
  sourceRef: z.string().trim().min(1).max(2000),
  status: z.string().trim().min(1).max(100),
  expectedScenarioRevision: z.number().int().positive(),
  expectedUseCaseRevision: z.number().int().positive().nullish(),
  expectedCanvasRevision: z.number().int().min(0).nullish(),
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const anatomiaEvidenceSchema = z.object({
  expectedProposalRevision: z.number().int().positive(),
  query: z.string().trim().min(1).max(8000),
}).strict();

export const imageApplySchema = z.object({
  expected_canvas_revision: z.number().int().min(0),
  candidate_ids: z.array(z.string().trim().min(1)).min(1).max(8),
}).strict();

export function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw AppError.badRequest('bad_body', parsed.error.flatten());
  return parsed.data;
}
