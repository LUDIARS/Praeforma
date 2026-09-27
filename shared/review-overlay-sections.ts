import type { ReviewOverlaySnapshot, OverlayScenario, OverlayImplementationReview } from './review-overlay.ts';
export interface ReviewSection { id: string; mode: 'spec' | 'status'; title: string; body: string }
const labels: Record<OverlayImplementationReview['state'], string> = { unregistered: 'タスク未登録', in_progress: '実装タスク未完了', returned: '差し戻し・追加作業あり',
  specification_changed: '仕様変更・再確認が必要', awaiting_confirmation: 'タスク完了・人間確認待ち', completed: '人間確認済み・完了' };
function implementationSections(snapshot: ReviewOverlaySnapshot, scenario?: OverlayScenario): ReviewSection[] {
  return snapshot.implementation.items.filter(item => scenario ? item.kind === 'scenario' && item.id === scenario.id : item.kind === 'spec').map(item => ({
    id: `implementation-${item.kind}-${item.id}`, mode: 'status', title: `${item.title}: ${labels[item.state]}`,
    body: [item.tasks.map(task => `${task.title}: ${task.status}\nActio タスク: ${task.id}`).join('\n\n') || 'Actio に対象タスクを関連付けてください。',
      item.confirmation ? `人間確認: ${item.confirmation.confirmedAt}\n${item.confirmation.note}` : ''].filter(Boolean).join('\n'),
  }));
}
export function reviewSections(snapshot: ReviewOverlaySnapshot, scenario?: OverlayScenario): ReviewSection[] {
  if (scenario) return [{ id: `scenario-${scenario.id}`, mode: 'spec', title: `${scenario.name} r${scenario.revision}`,
    body: [`ユーザー体験: ${scenario.experience || '未記入'}`, scenario.goal, scenario.visualDirection, `成功条件: ${scenario.successOutcome}`].filter(Boolean).join('\n') },
    ...implementationSections(snapshot, scenario), ...scenario.evidence.map((item, i): ReviewSection => ({ id: `evidence-${scenario.id}-${i}`, mode: 'status',
      title: `${item.kind}: ${item.status}${item.isStale ? '（再確認が必要）' : ''}`, body: `${item.sourceRevision}\n${item.sourceRef}` }))];
  const { latestRun, results: r, specVersion } = snapshot.acceptance;
  return [
    ...snapshot.specs.map((spec): ReviewSection => ({ id: `spec-${spec.id}`, mode: 'spec', title: `${spec.code} ${spec.title} (${spec.status} v${spec.version})`, body: spec.description || '本文は未記入です。' })),
    { id: 'actio', mode: 'status', title: 'Actio の実装状況', body: snapshot.implementation.message },
    ...implementationSections(snapshot),
    { id: 'tests', mode: 'status', title: 'プロジェクト全体のテスト', body: latestRun
      ? `${latestRun.status}\n合格 ${r.passed} / 失敗 ${r.failed} / 評価不可 ${r.blocked} / 未判定 ${r.pending}\nテスト対象仕様版: ${latestRun.version ?? '不明'}\n現行仕様版: ${specVersion}`
      : `テスト: 未実施\n現行仕様版: ${specVersion}` },
  ];
}
