import { z } from 'zod';
import { manualLanguageIssues } from '../../../shared/feature-manual.ts';

const sentence = z.string().trim().min(1).max(1200);
export const manualDocumentSchema = z.object({
  title: sentence.max(100), purpose: sentence,
  sections: z.array(z.object({ heading: sentence.max(100), text: sentence }).strict()).min(1).max(12),
  diagram: z.object({ caption: sentence.max(300), steps: z.array(z.object({
    label: sentence.max(200), branches: z.array(z.object({ condition: sentence.max(150), result: sentence.max(250) }).strict()).max(4),
  }).strict()).min(2).max(12) }).strict(),
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
