import { z } from 'zod';
import type { CanvasElement } from '../db/schema/ux-design.ts';
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

const finitePosition = z.number().finite().min(-100_000).max(100_000);
const positiveSize = z.number().finite().positive().max(100_000);
const frameSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4000),
  states: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(200),
    condition: z.string().max(1000),
    content: z.string().max(4000),
  }).strict()).max(50),
  x: finitePosition,
  y: finitePosition,
  width: positiveSize,
  height: positiveSize,
  viewport: z.object({ width: positiveSize, height: positiveSize }).strict(),
}).strict();

const elementSchema = z.object({
  id: z.string().trim().min(1).max(120),
  frame_id: z.string().trim().min(1).max(120),
  kind: z.enum(['box', 'text', 'button', 'input', 'image', 'list']),
  label: z.string().trim().min(1).max(300),
  x: finitePosition,
  y: finitePosition,
  width: positiveSize,
  height: positiveSize,
  sample_text: z.string().max(2000).nullable(),
  dynamic: z.object({
    enabled: z.boolean(),
    source: z.string().max(500).nullable(),
    update_condition: z.string().max(1000).nullable(),
  }).strict().nullable(),
  follow: z.object({
    target_element_id: z.string().trim().min(1).max(120),
    condition: z.string().trim().min(1).max(1000),
  }).strict().nullable(),
}).strict();

const transitionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  from: z.object({
    frame_id: z.string().trim().min(1).max(120),
    element_id: z.string().trim().min(1).max(120).nullable(),
  }).strict(),
  to_frame_id: z.string().trim().min(1).max(120),
  trigger: z.string().trim().min(1).max(1000),
  label: z.string().max(1000),
}).strict();

export const canvasSchema = z.object({
  expected_revision: z.number().int().min(0),
  frames: z.array(frameSchema).max(200),
  elements: z.array(elementSchema).max(5000),
  transitions: z.array(transitionSchema).max(2000),
}).strict().superRefine((value, ctx) => {
  const frameIds = new Set(value.frames.map((frame) => frame.id));
  const elementIds = new Set(value.elements.map((element) => element.id));
  const transitionIds = new Set(value.transitions.map((transition) => transition.id));
  const elementsById = new Map(value.elements.map((element) => [element.id, element]));
  if (frameIds.size !== value.frames.length) ctx.addIssue({ code: 'custom', message: 'duplicate_frame_id' });
  if (elementIds.size !== value.elements.length) ctx.addIssue({ code: 'custom', message: 'duplicate_element_id' });
  if (transitionIds.size !== value.transitions.length) ctx.addIssue({ code: 'custom', message: 'duplicate_transition_id' });
  for (const element of value.elements) {
    if (!frameIds.has(element.frame_id)) ctx.addIssue({ code: 'custom', message: `unknown_frame:${element.frame_id}` });
    if (element.follow && !elementIds.has(element.follow.target_element_id)) {
      ctx.addIssue({ code: 'custom', message: `unknown_follow_target:${element.follow.target_element_id}` });
    }
    if (element.follow && elementsById.get(element.follow.target_element_id)?.frame_id !== element.frame_id) {
      ctx.addIssue({ code: 'custom', message: `cross_frame_follow_target:${element.id}` });
    }
  }
  for (const element of value.elements) {
    const visited = new Set<string>();
    let cursor: CanvasElement | undefined = element as CanvasElement;
    while (cursor?.follow) {
      if (visited.has(cursor.id)) {
        ctx.addIssue({ code: 'custom', message: `follow_cycle:${element.id}` });
        break;
      }
      visited.add(cursor.id);
      cursor = elementsById.get(cursor.follow.target_element_id) as CanvasElement | undefined;
    }
  }
  for (const transition of value.transitions) {
    if (!frameIds.has(transition.from.frame_id) || !frameIds.has(transition.to_frame_id)) {
      ctx.addIssue({ code: 'custom', message: `unknown_transition_frame:${transition.id}` });
    }
    if (transition.from.element_id && !elementIds.has(transition.from.element_id)) {
      ctx.addIssue({ code: 'custom', message: `unknown_transition_element:${transition.id}` });
    }
    if (transition.from.element_id
      && elementsById.get(transition.from.element_id)?.frame_id !== transition.from.frame_id) {
      ctx.addIssue({ code: 'custom', message: `transition_element_frame_mismatch:${transition.id}` });
    }
  }
});

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
