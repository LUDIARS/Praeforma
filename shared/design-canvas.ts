import { z } from 'zod';
const finitePosition = z.number().finite().min(-100_000).max(100_000);
const positiveSize = z.number().finite().positive().max(100_000);
const frameSchema = z.object({
  device: z.enum(['unspecified', 'desktop', 'mobile']).optional(),
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
    let cursor: z.infer<typeof elementSchema> | undefined = element as z.infer<typeof elementSchema>;
    while (cursor?.follow) {
      if (visited.has(cursor.id)) {
        ctx.addIssue({ code: 'custom', message: `follow_cycle:${element.id}` });
        break;
      }
      visited.add(cursor.id);
      cursor = elementsById.get(cursor.follow.target_element_id) as z.infer<typeof elementSchema> | undefined;
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


export type DesignCanvasDocument = Omit<z.infer<typeof canvasSchema>, 'expected_revision'> & { revision: number };
