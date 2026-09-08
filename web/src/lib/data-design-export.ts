/** Portable design artifacts; never an executable Cernere update_schema payload. */
import { PROFILE_FIELDS, type DataDesignSnapshot, type LogicalStorage } from '../../../shared/data-design.ts';
import { validateDataDesign } from '../../../shared/data-design-validation.ts';

export const STORAGE_LABELS: Record<LogicalStorage['kind'], string> = {
  unassigned: '未定', cernere_profile: 'Cr 共通プロフィール', cernere_project: 'Cr プロジェクト領域',
  service_db: 'サービス DB', local: 'ローカル', object_storage: 'オブジェクトストレージ',
};

export function describeStorage(storage: LogicalStorage): string {
  if (storage.kind === 'cernere_profile') return 'Cr / ' + PROFILE_FIELDS[storage.field].label + ' (' + storage.field + ')';
  if (storage.kind === 'cernere_project') return 'Cr / ' + storage.projectKey + ' / ' + storage.module + ' / ' + storage.column;
  return STORAGE_LABELS[storage.kind] + ('location' in storage ? ' / ' + (storage.location || '名称未記入') : '');
}

function cell(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/\r?\n/g, '<br>');
}

export function designJson(snapshot: DataDesignSnapshot, projectId: string, unsaved: boolean): string {
  return JSON.stringify({ format: 'praeforma-data-design', projectId, applicationStatus: 'design_only',
    unsaved, baseRevision: snapshot.revision, definition: snapshot.definition,
    issues: validateDataDesign(snapshot.definition) }, null, 2);
}

export function designMarkdown(snapshot: DataDesignSnapshot, projectId: string, unsaved: boolean): string {
  const lines = ['# データ設計・論理保存先一覧', '', 'プロジェクト: ' + cell(projectId),
    '基準版: ' + snapshot.revision + (unsaved ? '（未保存の編集を含む）' : ''),
    '設計情報です。Cernere の実スキーマ・データ・権限への適用は行っていません。', ''];
  for (const dataset of snapshot.definition.datasets) {
    lines.push('## ' + cell(dataset.label || dataset.name), '', '識別名: ' + cell(dataset.name),
      '目的: ' + cell(dataset.purpose), '分類: ' + dataset.kind,
      '権威ソース: ' + cell(dataset.authority || '未記入'),
      '件数: ' + (dataset.cardinality === 'per_user' ? '1 ユーザー 1 行' : '複数レコード'), '',
      '| 項目 | 型 | 必須 / 主キー | 論理保存先 | 個人属性 | 保護 | 読取 / 更新 | 保持・削除 |',
      '|---|---|---|---|---|---|---|---|');
    for (const field of dataset.fields) lines.push('| ' + [field.name, field.type,
      (field.required ? '必須' : '任意') + (field.primaryKey ? ' / 主キー' : ''), describeStorage(field.storage),
      field.personalData ? 'はい' : 'いいえ', field.protection + ': ' + field.protectionNote,
      field.readAccess + ' / ' + field.writeAccess, field.retention].map(cell).join(' | ') + ' |');
    lines.push('');
  }
  const issues = validateDataDesign(snapshot.definition);
  lines.push('## 確認事項', '', ...(issues.length ? issues.map((issue) => '- [' + issue.severity + '] '
    + cell(issue.path) + ': ' + cell(issue.message)) : ['設計上の確認事項はありません。実環境との一致は未確認です。']));
  return lines.join('\n');
}

export function downloadDesign(contents: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  try {
    anchor.href = url; anchor.download = filename;
    document.body.append(anchor); anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
