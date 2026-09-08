/** Semantic design rules. Structural parsing belongs to the API boundary. PF-DATA-3/4/5/6. */
import { PROFILE_FIELDS, type DataDesign, type DataField, type DataSet, type DesignIssue } from './data-design.ts';

const NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
const PROJECT_KEY = /^[A-Za-z][A-Za-z0-9_-]{1,62}$/;
const CERNERE_TYPES = new Set(['text', 'integer', 'bigint', 'boolean', 'timestamp', 'json', 'uuid']);
const RESERVED_COLUMNS = new Set(['user_id', 'created_at', 'updated_at', '_deleted_columns',
  'select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'table', 'from', 'where', 'user', 'users', 'grant', 'revoke']);

function storageIssues(dataset: DataSet, field: DataField, path: string): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const add = (severity: DesignIssue['severity'], message: string): void => { issues.push({ severity, path, message }); };
  const storage = field.storage;
  if (storage.kind === 'unassigned') add('warning', '保存先が未定です。');
  if (field.personalData) {
    if (dataset.kind !== 'user') add('error', '個人属性は user データに分類してください。');
    if (field.protection !== 'required') add('error', '個人属性は保護必須にしてください。');
    if (!['unassigned', 'cernere_profile', 'cernere_project'].includes(storage.kind)) {
      add('error', '個人属性の正本は Cernere に設定してください。');
    }
  }
  if (storage.kind === 'cernere_profile' || storage.kind === 'cernere_project') {
    if (dataset.kind !== 'user') add('error', 'Cernere のユーザー領域は user データ用です。');
  }
  if (storage.kind === 'cernere_profile' && PROFILE_FIELDS[storage.field].type !== field.type) {
    add('error', '共通プロフィールの型と項目の型を一致させてください。');
  }
  if (storage.kind === 'cernere_project') {
    if (dataset.cardinality !== 'per_user') add('error', 'Cr のプロジェクト領域は 1 ユーザー 1 行です。');
    if (field.primaryKey) add('error', 'Cr のプロジェクト領域の主キーは user_id です。追加項目を主キーにはできません。');
    if (!CERNERE_TYPES.has(field.type)) add('error', 'この型は Cr のプロジェクト領域で扱えません。');
    if (!PROJECT_KEY.test(storage.projectKey)) add('error', 'Cr project key は英字始まりの英数字・_・-、2〜63 文字で指定してください。');
    if (!storage.module.trim()) add('error', 'Cr のモジュールを指定してください。');
    if (!NAME.test(storage.column) || RESERVED_COLUMNS.has(storage.column.toLowerCase())) {
      add('error', 'Cr の列名は英字・_ 始まりの英数字・_、63 文字以内で指定し、予約列名を避けてください。');
    }
  }
  if ('location' in storage && !storage.location.trim()) add('warning', '論理的な保存先の名前を記入してください。');
  if (field.protection === 'undecided') add('warning', '保護が必要か決めてください。');
  if (field.protection === 'required') {
    if (!field.protectionNote.trim()) add('warning', '保護方法を記入してください。');
    if (!field.readAccess.trim() || !field.writeAccess.trim()) add('warning', '誰が読めるか・更新できるかを記入してください。');
    if (!field.retention.trim()) add('warning', '保持期間・削除方針を記入してください。');
  }
  return issues;
}

export function validateDataDesign(design: DataDesign): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const fields = new Map<string, DataField>();
  const destinations = new Set<string>();
  const add = (path: string, message: string, severity: DesignIssue['severity'] = 'error'): void => {
    issues.push({ severity, path, message });
  };
  if (design.datasets.length === 0) add('データ設計', 'データセットが未定義です。', 'warning');
  const identity = (id: string, path: string): void => {
    if (ids.has(id)) add(path, 'ID が重複しています。');
    ids.add(id);
  };
  for (const dataset of design.datasets) {
    const path = dataset.label || dataset.name || 'データセット';
    identity(dataset.id, path);
    if (!NAME.test(dataset.name)) add(path, 'データセット識別名を英字・_ 始まりの英数字・_、63 文字以内で指定してください。');
    if (names.has(dataset.name)) add(path, 'データセット識別名が重複しています。');
    names.add(dataset.name);
    if (!dataset.authority.trim()) add(path, '権威ソース（誰が正本を管理するか）を記入してください。', 'warning');
    if (dataset.fields.length === 0) add(path, '項目が未定義です。', 'warning');
    const fieldNames = new Set<string>();
    for (const field of dataset.fields) {
      const fieldPath = path + '.' + (field.name || '項目');
      identity(field.id, fieldPath);
      fields.set(field.id, field);
      if (!NAME.test(field.name)) add(fieldPath, '項目名を英字・_ 始まりの英数字・_、63 文字以内で指定してください。');
      if (fieldNames.has(field.name)) add(fieldPath, 'データセット内の項目名が重複しています。');
      fieldNames.add(field.name);
      if (field.primaryKey && !field.required) add(fieldPath, '主キー項目は必須にしてください。');
      issues.push(...storageIssues(dataset, field, fieldPath));
      if (field.storage.kind === 'cernere_project') {
        // module is a grouping, not a separate table namespace.
        const target = JSON.stringify([field.storage.projectKey, field.storage.column]);
        if (destinations.has(target)) add(fieldPath, '同じ Cr プロジェクトの列を複数項目に割り当てています。参照項目で関係を表してください。');
        destinations.add(target);
      }
    }
  }
  for (const dataset of design.datasets) for (const field of dataset.fields) {
    if (!field.referenceFieldId) continue;
    const target = fields.get(field.referenceFieldId);
    const path = dataset.name + '.' + field.name;
    if (!target) add(path, '参照先の項目が見つかりません。');
    else if (target.id === field.id) add(path, '項目自身は参照先にできません。');
    else if (target.type !== field.type) add(path, '参照元と参照先の型を一致させてください。');
  }
  return issues;
}
