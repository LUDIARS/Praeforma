import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type ApiError, type Spec } from '../../lib/api.ts';
import { specTermIssues, type Contract, type Measurement } from '../../../../shared/spec-terms.ts';
import { SpecTermsView } from './SpecTermsView.tsx';
import { SpecTermForm, contractFromInput, measurementFromInput } from './SpecTermsForms.tsx';

/** 構造化仕様 1 件の計測・契約の表示と追加・削除。保存は spec.version の楽観ロックで行う。 */
export function SpecTermsPanel({ pid, spec }: { pid: string; spec: Spec }): React.ReactElement {
  const queryClient = useQueryClient();
  const measurements = spec.measurements ?? [];
  const contracts = spec.contracts ?? [];
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async (next: { measurements?: Measurement[]; contracts?: Contract[] }): Promise<void> => {
    setSaving(true); setError(null);
    try {
      await api.updateSpec(pid, spec.id, { prev_version: spec.version, ...next });
      await queryClient.invalidateQueries({ queryKey: ['specs', pid] });
    } catch (cause) {
      const status = (cause as ApiError).status;
      setError(status === 409 ? '他の編集と競合しました。再読み込みしてからやり直してください。'
        : status === 403 ? '計測・契約を編集する権限がありません。'
        : '保存できませんでした。入力は残っています。');
    } finally { setSaving(false); }
  };
  const nextId = (prefix: string, used: readonly { id: string }[]): string => {
    let index = used.length + 1;
    while (used.some((item) => item.id === `${prefix}${index}`)) index += 1;
    return `${prefix}${index}`;
  };

  return <section className="spec-terms-panel" aria-label="数値計測と契約">
    <SpecTermsView measurements={measurements} contracts={contracts}
      issues={specTermIssues({ measurements, contracts })}
      onRemove={(kind, id) => void save(kind === 'measurement'
        ? { measurements: measurements.filter((item) => item.id !== id) }
        : { contracts: contracts.filter((item) => item.id !== id) })} />
    {error ? <p role="alert">{error}</p> : null}
    <details><summary>計測・契約を記載する</summary>
      <p className="meta">記載するだけで、実際の計測や報酬の付与は行いません。</p>
      <SpecTermForm kind="measurement" disabled={saving}
        onAdd={(input) => void save({ measurements: [...measurements, measurementFromInput(nextId('m', measurements), input)] })} />
      <SpecTermForm kind="contract" disabled={saving}
        onAdd={(input) => void save({ contracts: [...contracts, contractFromInput(nextId('c', contracts), input)] })} />
    </details>
  </section>;
}
