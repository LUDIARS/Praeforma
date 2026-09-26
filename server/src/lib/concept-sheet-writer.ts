// 企画概要書を Astra に設計させる (spec/feature/concept-sheet.md PF-CS-3)。
// 1 回目の出力が確認 (concept-sheet-design-check.ts) を通らなければ、問題を添えて 1 回だけ直させる。
// それでも通らなければ保存しない。材料が足りないと Astra が言えば 422 で止める (推測で埋めない)。
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { ConceptSheetDesign, SceneImageType } from '../../../shared/concept-sheet.ts';
import { ASTRA_MODEL, type AstraEffort, type AstraRequest } from './astra-cli.ts';
import { buildConceptSheetPrompt, CONCEPT_SHEET_OUTPUT_SCHEMA } from './concept-sheet-prompt.ts';
import { checkConceptSheetOutput } from './concept-sheet-design-check.ts';
import { AppError } from './errors.ts';
import type { ConceptSheetMaterial } from './concept-sheet-sources.ts';
import type { DecodedSceneImage } from './concept-sheet-input.ts';

export interface ConceptSheetWriterInput {
  material: ConceptSheetMaterial;
  images: DecodedSceneImage[];
  instructions: string;
  previous: ConceptSheetDesign | null;
}
export interface ConceptSheetWriterResult { design: ConceptSheetDesign; skillDigest: string; model: string }
export type ConceptSheetWriter = (input: ConceptSheetWriterInput) => Promise<ConceptSheetWriterResult>;
export type AstraRunner = (request: AstraRequest) => Promise<string>;

/** 設計は深く考えさせる (数分〜十数分)。直しは指摘の範囲なので一段軽くする。 */
const ATTEMPTS: ReadonlyArray<{ effort: AstraEffort; timeoutMs: number }> = [
  { effort: 'xhigh', timeoutMs: 25 * 60_000 },
  { effort: 'high', timeoutMs: 15 * 60_000 },
];
const EXT: Record<SceneImageType, 'png' | 'jpg' | 'webp'> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function loadConceptSheetSkill(): Promise<{ text: string; digest: string }> {
  const text = await readFile(new URL('../../../skills/concept-sheet/SKILL.md', import.meta.url), 'utf8');
  return { text, digest: createHash('sha256').update(text).digest('hex') };
}

export function makeConceptSheetWriter(run: AstraRunner): ConceptSheetWriter {
  return async ({ material, images, instructions, previous }) => {
    const skill = await loadConceptSheetSkill();
    const imageLabels = images.map((i) => i.image.label);
    const files = images.map((i) => ({ bytes: i.bytes, ext: EXT[i.image.mimeType] }));
    let repair: { issues: string[]; html: string } | null = null;
    for (const attempt of ATTEMPTS) {
      const prompt = buildConceptSheetPrompt({ skill: skill.text, material, imageLabels, instructions, previous, repair });
      const raw = await run({ prompt, images: files, outputSchema: CONCEPT_SHEET_OUTPUT_SCHEMA, ...attempt });
      const checked = checkConceptSheetOutput(raw, { imageLabels, catchcopy: material.catchcopy.text });
      if (checked.kind === 'ok') return { design: checked.design, skillDigest: skill.digest, model: ASTRA_MODEL };
      if (checked.kind === 'insufficient') throw new AppError('concept_sheet_insufficient_ux', 422);
      repair = { issues: checked.issues, html: checked.html };
    }
    throw new AppError('concept_sheet_quality_check_failed', 422, { issues: repair?.issues ?? [] });
  };
}
