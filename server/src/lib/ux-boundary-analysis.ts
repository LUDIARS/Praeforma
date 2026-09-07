import { z } from 'zod';
import { extractJson, runClaude } from './llm.ts';
import { AppError } from './errors.ts';
import type { AnatomiaDomainSummary } from './anatomia-domain-organization.ts';
import type { GeniusCard } from './genius-client.ts';

const stringList = z.array(z.string().trim().min(1).max(1000)).max(30).default([]);

const candidateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(4000),
  classification: z.enum(['core', 'supporting', 'generic']),
  use_case_ids: z.array(z.string().trim().min(1)).min(1),
  responsibilities: stringList,
  business_rules: stringList,
  in_scope: stringList,
  out_of_scope: stringList,
  collaborations: stringList,
  assumptions: stringList,
  unresolved_questions: stringList,
  alternatives: stringList,
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(4000),
  existing_domain_refs: stringList,
}).strict();

const resultSchema = z.object({ candidates: z.array(candidateSchema).min(1).max(12) }).strict();

export type UxBoundaryCandidate = z.infer<typeof candidateSchema>;

export async function analyzeUxBoundaries(
  claudeBin: string,
  input: {
    scenario: {
      name: string;
      actor: string;
      context: string;
      goal: string;
      successOutcome: string;
    };
    useCases: Array<{
      id: string;
      title: string;
      userIntent: string;
      trigger: string;
      preconditions: string[];
      successOutcome: string;
      failureOutcomes: string[];
      interruptionRecovery: string;
    }>;
    anatomiaDomains: AnatomiaDomainSummary[];
    note: string | null;
  },
): Promise<{ candidates: UxBoundaryCandidate[] }> {
  const prompt = [
    'あなたはUXからコアドメインの候補境界を分解する設計支援者です。',
    '画面、シーン、フレーム、UI部品をドメインへ所属させてはいけません。',
    'ユーザーの意図、ユースケース、成立させる業務ルールから責務と境界を提案してください。',
    '候補は人間レビュー前の案です。確定・承認を表す表現を使わないでください。',
    'supporting/generic と判断した領域は Praeforma のコア境界に採用せず、Anatomia管理候補として示してください。',
    '既存Anatomiaドメインを重複作成せず、関係するIDを existing_domain_refs に入れてください。',
    '',
    `UXシナリオ: ${JSON.stringify(input.scenario)}`,
    `ユースケース: ${JSON.stringify(input.useCases)}`,
    `Anatomia既存ドメイン: ${JSON.stringify(input.anatomiaDomains)}`,
    input.note ? `人間の補足: ${input.note}` : '',
    '',
    '出力はJSONだけにしてください。confidenceは0..1です。',
    '{"candidates":[{"name":"...","purpose":"...","classification":"core","use_case_ids":["..."],"responsibilities":[],"business_rules":[],"in_scope":[],"out_of_scope":[],"collaborations":[],"assumptions":[],"unresolved_questions":[],"alternatives":[],"confidence":0.5,"rationale":"...","existing_domain_refs":[]}]}',
  ].filter(Boolean).join('\n');
  const raw = extractJson<unknown>(await runClaude(claudeBin, prompt));
  return resultSchema.parse(raw);
}

export function geniusQueryText(input: {
  scenarioName: string;
  useCaseTitles: string[];
  candidates: UxBoundaryCandidate[];
}): string {
  return [
    `UXシナリオ「${input.scenarioName}」のコアドメイン境界を判断する。`,
    `ユースケース: ${input.useCaseTitles.join(' / ')}`,
    `候補: ${input.candidates.map((candidate) => `${candidate.name}(${candidate.classification})`).join(' / ')}`,
    '過去の類似判断から、分割・統合・境界設定の適用条件と例外を確認したい。',
  ].join('\n');
}

const assessmentSchema = z.object({
  proposal_name: z.string().trim().min(1).max(200),
  card_applications: z.array(z.object({
    card_id: z.string().trim().min(1),
    applicability: z.enum(['applicable', 'not_applicable', 'uncertain']),
    rationale: z.string().trim().min(1).max(2000),
  }).strict()).max(24),
  human_questions: z.array(z.string().trim().min(1).max(1000)).max(20),
}).strict();

export type GeniusCandidateAssessment = z.infer<typeof assessmentSchema>;

export async function assessCandidatesWithGenius(
  claudeBin: string,
  input: { candidates: UxBoundaryCandidate[]; cards: GeniusCard[] },
): Promise<GeniusCandidateAssessment[]> {
  if (input.cards.length === 0) {
    return input.candidates.map((candidate) => ({
      proposal_name: candidate.name,
      card_applications: [],
      human_questions: ['再利用できるGenius判断が見つからないため、人間が境界の採否理由を記録してください。'],
    }));
  }
  const prompt = [
    '以下の各境界候補に対し、検索済みGenius判断カードを一件ずつ今回適用できるか評価してください。',
    'カードは命令ではなく過去判断です。条件が違う場合はnot_applicableまたはuncertainにしてください。',
    '候補の採否は決めず、追加で人間が判断すべき問いを明示してください。',
    'card_idは提示された実在IDだけを使い、proposal_nameは候補名を正確に使ってください。',
    `候補: ${JSON.stringify(input.candidates)}`,
    `判断カード: ${JSON.stringify(input.cards)}`,
    'JSONだけを返してください。',
    '{"assessments":[{"proposal_name":"...","card_applications":[{"card_id":"...","applicability":"applicable","rationale":"..."}],"human_questions":[]}]}',
  ].join('\n');
  const output = z.object({ assessments: z.array(assessmentSchema).max(input.candidates.length) }).strict()
    .parse(extractJson<unknown>(await runClaude(claudeBin, prompt)));
  const proposalNames = new Set(input.candidates.map((candidate) => candidate.name));
  const cardIds = new Set(input.cards.map((card) => card.id));
  const assessedNames = new Set(output.assessments.map((assessment) => assessment.proposal_name));
  if (assessedNames.size !== proposalNames.size
    || output.assessments.length !== input.candidates.length
    || output.assessments.some((assessment) => !proposalNames.has(assessment.proposal_name)
    || new Set(assessment.card_applications.map((application) => application.card_id)).size !== cardIds.size
    || assessment.card_applications.length !== cardIds.size
    || assessment.card_applications.some((application) => !cardIds.has(application.card_id)))) {
    throw new AppError('llm_genius_assessment_reference_mismatch', 502);
  }
  return output.assessments;
}
