/** Turns the writer's raw reply into a manual, a declared refusal, or a quality failure. */
import { z } from 'zod';
import { extractJson } from './llm.ts';
import { manualDocumentSchema } from './manual-input.ts';
import { AppError } from './errors.ts';
import type { ManualDocument } from '../../../shared/feature-manual.ts';

const REASON_LIMIT = 1000;
const refusalSchema = z.object({ error: z.string().trim().min(1) }).strict();

export function interpretManualResponse(raw: string): ManualDocument {
  let value: unknown;
  try { value = extractJson<unknown>(raw); }
  catch { throw new AppError('manual_quality_check_failed',422); /* Do not expose model excerpts in errors. */ }
  // The prompt asks for {"error": reason} when the material cannot support a manual; the editor needs that reason to fix the material.
  const refusal = refusalSchema.safeParse(value);
  if (refusal.success) throw new AppError('manual_insufficient_material',422,{ reason: refusal.data.error.slice(0,REASON_LIMIT) });
  const parsed = manualDocumentSchema.safeParse(value);
  if (!parsed.success) {
    // Only the fixed wording-check messages are returned; structural failures carry no model text.
    const issues = parsed.error.issues.filter(issue => issue.code === z.ZodIssueCode.custom).map(issue => issue.message);
    throw new AppError('manual_quality_check_failed',422,issues.length ? { issues } : undefined);
  }
  return parsed.data;
}
