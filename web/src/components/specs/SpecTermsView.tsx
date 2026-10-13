import React from 'react';
import type { Contract, Measurement, SpecTermIssue } from '../../../../shared/spec-terms.ts';
import { observedLabel } from '../../../../shared/spec-terms.ts';

/**
 * 仕様に記載した数値計測と契約の表示 (PF-SPEC-TERMS)。未計測は「未計測」と出し、0 にしない。
 * 未定義の箇所と食い違いは未解決事項として並べる (値は補わない)。
 */
export function SpecTermsView({ measurements, contracts, issues, onRemove }: {
  measurements: readonly Measurement[];
  contracts: readonly Contract[];
  issues: readonly SpecTermIssue[];
  onRemove?: (kind: 'measurement' | 'contract', id: string) => void;
}): React.ReactElement {
  return <div className="spec-terms">
    <strong>数値計測</strong>
    {measurements.length === 0 ? <p className="meta">計測は記載されていません。</p> : <table className="spec-terms-table">
      <thead><tr><th>対象</th><th>指標</th><th>単位</th><th>方法</th><th>期間・集計</th><th>目標・判定</th><th>実測</th>{onRemove ? <th /> : null}</tr></thead>
      <tbody>{measurements.map((item) => <tr key={item.id}>
        <td>{item.subject || 'この仕様'}</td><td>{item.metric}</td><td>{item.unit}</td>
        <td>{item.method || '未定義'}</td><td>{item.period || '未定義'}</td><td>{item.target || '未定義'}</td>
        <td title={item.observed?.ref}>{observedLabel(item)}</td>
        {onRemove ? <td><button type="button" className="ghost" onClick={() => onRemove('measurement', item.id)}>外す</button></td> : null}
      </tr>)}</tbody>
    </table>}
    <strong>契約 (条件と報酬)</strong>
    {contracts.length === 0 ? <p className="meta">契約は記載されていません。</p> : <table className="spec-terms-table">
      <thead><tr><th>対象</th><th>成立条件</th><th>判定方法・根拠</th><th>報酬</th><th>付与時点</th><th>例外・取消</th>{onRemove ? <th /> : null}</tr></thead>
      <tbody>{contracts.map((item) => <tr key={item.id}>
        <td>{item.subject || 'この仕様'}</td><td>{item.condition || '未定義'}</td><td>{item.judgement || '未定義'}</td>
        <td>{rewardLabel(item)}</td><td>{item.grantTiming || '未定義'}</td><td>{item.exceptions || 'なし'}</td>
        {onRemove ? <td><button type="button" className="ghost" onClick={() => onRemove('contract', item.id)}>外す</button></td> : null}
      </tr>)}</tbody>
    </table>}
    {issues.length > 0 ? <div role="status" className="spec-terms-issues"><strong>未解決事項</strong>
      <ul>{issues.map((issue, index) => <li key={`${issue.kind}:${index}`}>{issue.message}</li>)}</ul></div> : null}
  </div>;
}

function rewardLabel(contract: Contract): string {
  const { content, amount, unit } = contract.reward;
  if (!content && amount === null) return '未定義';
  const quantity = amount === null ? '' : ` ${amount}${unit ? ` ${unit}` : ' (単位未定義)'}`;
  return `${content || '内容未定義'}${quantity}`;
}
