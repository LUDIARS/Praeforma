import { z } from 'zod';
import { manualLanguageIssues } from '../../../shared/feature-manual.ts';
import { MANUAL_LIMITS as L } from './manual-limits.ts';

const sentence = z.string().trim().min(1).max(1200);
export const manualDocumentSchema = z.object({
  title: sentence.max(L.title), purpose: sentence.max(L.purpose),
  sections: z.array(z.object({ heading: sentence.max(L.heading), text: sentence.max(L.text) }).strict()).min(L.sections.min).max(L.sections.max),
  diagram: z.object({ caption: sentence.max(L.caption), steps: z.array(z.object({
    label: sentence.max(L.label), branches: z.array(z.object({ condition: sentence.max(L.condition), result: sentence.max(L.result) }).strict()).max(L.branches.max),
  }).strict()).min(L.steps.min).max(L.steps.max) }).strict(),
}).strict().superRefine((doc, ctx) => {
  for (const message of manualLanguageIssues(doc)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});
export const manualGenerationSchema = z.object({
  id: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), specId: z.string().min(1).max(100),
  implementation: z.object({ reference: sentence.max(300), version: sentence.max(200), content: z.string().trim().min(20).max(80000) }).strict(),
}).strict();
export const manualSaveSchema = z.object({
  expectedRevision: z.number().int().positive(), basis: z.enum(['saved', 'proposal']), document: manualDocumentSchema,
}).strict();
