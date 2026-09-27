import { node, specification } from './content.mjs';

const labels = { unregistered: 'タスク未登録', in_progress: '実装タスク未完了', returned: '差し戻し・追加作業あり',
  specification_changed: '仕様変更・再確認が必要', awaiting_confirmation: 'タスク完了・人間確認待ち', completed: '人間確認済み・完了' };

export function showStatus(container, snapshot, selected) {
  container.append(node('h3', 'Actio の実装状況'));
  const implementation = snapshot.implementation;
  if (!implementation) throw new Error('実装状況を取得できませんでした。Pf を更新してください。');
  container.append(node('p', implementation.message));
  implementation.items.filter(item => item.kind === 'spec' || !selected || item.id === selected.id).forEach(item => {
    const body = item.tasks.map(task => `${task.title}: ${task.status}\nActio タスク: ${task.id}`).join('\n\n');
    container.append(specification(item.title, body || 'Actio に対象タスクを関連付けてください。', labels[item.state] ?? '未確認'));
    if (item.confirmation) container.append(node('p', `人間確認: ${item.confirmation.confirmedAt}\n${item.confirmation.note}`));
  });
  const scenarios = selected ? [selected] : snapshot.scenarios;
  scenarios.forEach(scenario => {
    scenario.evidence.forEach(item => container.append(specification(
      `検証根拠: ${item.kind}`, `${item.sourceRevision}\n${item.sourceRef}`, `${item.status}${item.isStale ? '（再確認が必要）' : ''}`)));
  });
  const { latestRun, results: r, specVersion } = snapshot.acceptance;
  container.append(node('h3', 'プロジェクト全体のテスト'), node('p', latestRun
    ? `${latestRun.status}\n合格 ${r.passed} / 失敗 ${r.failed} / 評価不可 ${r.blocked} / 未判定 ${r.pending}\nテスト対象仕様版: ${latestRun.version ?? '不明'}\n現行仕様版: ${specVersion}`
    : `未実施\n現行仕様版: ${specVersion}`));
}
