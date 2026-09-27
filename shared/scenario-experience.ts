import { z } from 'zod';

export const scenarioCategorySchema = z.enum(['gameplay', 'expression']);
export type ScenarioCategory = z.infer<typeof scenarioCategorySchema>;
export const scenarioCategoryLabels: Record<ScenarioCategory, string> = {
  gameplay: 'ゲームプレイ', expression: '表現',
};

export interface ScenarioExperience {
  category: ScenarioCategory;
  experience: string;
  visualDirection: string;
}

/** Validate the merged record on PATCH, so partial edits cannot bypass the contract. */
export function scenarioExperienceIssues(value: ScenarioExperience): string[] {
  const issues: string[] = [];
  if (!value.experience.trim()) issues.push('scenario_experience_required');
  if (value.category === 'expression' && !value.visualDirection.trim()) issues.push('scenario_visual_direction_required');
  return issues;
}
