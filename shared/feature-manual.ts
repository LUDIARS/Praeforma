/** Reader-facing documents contain plain text only; provenance is stored separately. */
export interface ManualDocument {
  title: string;
  purpose: string;
  sections: Array<{ heading: string; text: string }>;
  diagram: { caption: string; steps: Array<{ label: string; branches: Array<{ condition: string; result: string }> }> };
}
export interface ManualSource {
  specId: string;
  specDigest: string;
  implementation: { reference: string; version: string; content: string };
  implementationDigest: string;
  skillDigest: string;
}
export interface ManualRecord {
  id: string;
  projectId: string;
  document: ManualDocument | null;
  proposal: ManualDocument;
  source: ManualSource;
  publishedSource: ManualSource | null;
  revision: number;
  updatedAt: string;
  freshness: 'current' | 'outdated' | 'unavailable';
}
/** A necessary lexical check, in addition to the writer's semantic review. PF-MANUAL-4. */
export function manualLanguageIssues(document: ManualDocument): string[] {
  const text = [document.title, document.purpose, ...document.sections.flatMap(s => [s.heading, s.text]),
    document.diagram.caption, ...document.diagram.steps.flatMap(s => [s.label, ...s.branches.flatMap(b => [b.condition, b.result])])].join('\n');
  const terms = text.match(/\b(?:API|DB|SQL|JSON|HTML|CSS|HTTP|UUID|SDK|CLI|commit|endpoint|schema)\b|スキーマ|エンドポイント|コンポーネント|トランザクション|データベース|リポジトリ|メソッド|インスタンス|バックエンド|フロントエンド|パラメータ|```|<\/?[a-z][^>]*>/giu);
  return [...new Set(terms ?? [])].map(term => `「${term}」を身近な言葉に置き換えてください。`);
}
