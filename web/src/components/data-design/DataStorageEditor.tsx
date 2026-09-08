/** Logical destination controls for one field. No credentials, physical storage paths or DDL. PF-DATA-5/7. */
import React from 'react';
import { PROFILE_FIELDS, type DataField, type LogicalStorage, type ProfileField } from '../../../../shared/data-design.ts';
import { STORAGE_LABELS, describeStorage } from '../../lib/data-design-export.ts';

interface Props { field: DataField; onChange: (patch: Partial<DataField>) => void }

export function DataStorageEditor({ field, onChange }: Props): React.ReactElement {
  const storage = field.storage;
  function choose(kind: LogicalStorage['kind']): void {
    if (kind === 'cernere_profile') {
      onChange({ storage: { kind, field: 'users.display_name' }, type: 'text', personalData: true, protection: 'required' });
    } else if (kind === 'cernere_project') {
      onChange({ storage: { kind, projectKey: '', module: '', column: field.name } });
    } else if (kind === 'unassigned') onChange({ storage: { kind } });
    else onChange({ storage: { kind, location: '' } });
  }
  return <section className="data-storage" aria-label="論理保存先">
    <label>保存先
      <select value={storage.kind} onChange={(event) => choose(event.target.value as LogicalStorage['kind'])}>
        {Object.entries(STORAGE_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
      </select>
    </label>
    {storage.kind === 'cernere_profile' && <>
      <label>参照する共通プロフィール項目
        <select value={storage.field} onChange={(event) => {
          const target = event.target.value as ProfileField;
          onChange({ storage: { kind: 'cernere_profile', field: target }, type: PROFILE_FIELDS[target].type });
        }}>
          {Object.entries(PROFILE_FIELDS).map(([key, value]) => <option key={key} value={key}>{value.label} ({key})</option>)}
        </select>
      </label>
      <p className="data-hint">Cr が管理する個人属性の正本を参照します。読み取り・更新の許可は Cr 側で別途管理します。</p>
    </>}
    {storage.kind === 'cernere_project' && <>
      <div className="data-grid data-grid-three">
        <label>Cr プロジェクトキー
          <input value={storage.projectKey} maxLength={63} placeholder="例: my_service"
            onChange={(event) => onChange({ storage: { ...storage, projectKey: event.target.value } })} />
        </label>
        <label>モジュール
          <input value={storage.module} maxLength={100} placeholder="例: preferences"
            onChange={(event) => onChange({ storage: { ...storage, module: event.target.value } })} />
        </label>
        <label>保存する列名
          <input value={storage.column} maxLength={63} placeholder="例: notification_enabled"
            onChange={(event) => onChange({ storage: { ...storage, column: event.target.value } })} />
        </label>
      </div>
      <p className="data-hint">1 ユーザー 1 行のプロジェクト固有データです。モジュールは公開停止（opt-out）の単位です。既存の氏名やメールは共通プロフィールを参照してください。</p>
    </>}
    {'location' in storage && <label>論理的な保存先の名前
      <input value={storage.location} maxLength={500} placeholder="例: 注文サービス / orders テーブル"
        onChange={(event) => onChange({ storage: { ...storage, location: event.target.value } })} />
    </label>}
    <output className="data-destination">{describeStorage(storage)}</output>
  </section>;
}
