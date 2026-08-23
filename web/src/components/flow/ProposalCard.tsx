// トークエリアの提案カード。 ユーザが個別に「反映」を押すまで DB には書かれない (§5.3)。
//
// @spec 5.3 提案

import React from 'react';
import type { Proposal } from '../../lib/screen-flow-api.ts';

interface Props {
  proposal: Proposal;
  index: number;
  applied: boolean;
  busy: boolean;
  screenName: (id: string) => string;
  widgetName: (placementId: string | null) => string;
  onApply: (index: number) => void;
}

export function ProposalCard({ proposal, index, applied, busy, screenName, widgetName, onApply }: Props): React.ReactElement {
  let title = '';
  let body: React.ReactNode = null;
  if (proposal.kind === 'spec') {
    title = `要件: ${proposal.title}`;
    body = (
      <>
        <div>{proposal.description}</div>
        {proposal.acceptance?.length ? (
          <ul>
            {proposal.acceptance.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : null}
        <div className="muted">
          {proposal.priority ?? 'should'} / {proposal.category ?? 'behavior'}
          {/* target はモデル任せなので欠けることがある (サーバも紐づけ無しの spec を許す)。 */}
          {proposal.target ? ` → ${proposal.target.kind}:${proposal.target.id}` : ' → (紐づけなし)'}
        </div>
      </>
    );
  } else if (proposal.kind === 'transition') {
    title = `遷移: ${screenName(proposal.from_layout_id)} → ${screenName(proposal.to_layout_id)}`;
    body = (
      <div className="muted">
        起点 {widgetName(proposal.source_object_id)} / {proposal.trigger}
        {proposal.condition ? ` / ${proposal.condition}` : ''}
      </div>
    );
  } else {
    title = `UI 要素: ${proposal.label} (${proposal.widget})`;
    body = (
      <div className="muted">
        画面 {screenName(proposal.layout_id)} / action={proposal.action ?? 'none'}
      </div>
    );
  }
  return (
    <div className={`proposal-card ${applied ? 'applied' : ''}`}>
      <div className="proposal-head">
        <strong>{title}</strong>
        <button type="button" className="primary" disabled={busy || applied} onClick={() => onApply(index)}>
          {applied ? '反映済' : '反映'}
        </button>
      </div>
      <div className="proposal-body">{body}</div>
    </div>
  );
}
