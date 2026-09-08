/** Bounded presentation of the complete document's design validation. PF-DATA-4. */
import React from 'react';
import type { DesignIssue } from '../../../../shared/data-design.ts';

export function DataDesignIssues({ issues }: { issues: readonly DesignIssue[] }): React.ReactElement {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const ordered = [...errors, ...warnings];
  return <section className="data-issues" aria-label="設計の確認事項">
    <h3>修正が必要: {errors.length} / 未設計: {warnings.length}</h3>
    {ordered.length === 0 ? <p>設計上の確認事項はありません。保存先の存在や実際の権限は、利用サービス側で確認してください。</p>
      : <><ul>{ordered.slice(0, 30).map((issue, index) => <li key={issue.path + index}
        className={issue.severity === 'error' ? 'data-error' : ''}>
        <strong>{issue.path}</strong>: {issue.message}
      </li>)}</ul>{ordered.length > 30 && <p>ほか {ordered.length - 30} 件。設計 JSON に全件を含めて書き出せます。</p>}</>}
    {warnings.length > 0 && <p className="data-hint">未設計の項目は下書きとして保存できます。</p>}
  </section>;
}
