import React from 'react';
import '../styles/project-tabs.css';

const PROJECT_TABS = [
  { id: 'overview', label: '概要' },
  { id: 'ux-goal', label: 'UX/ゴール' },
  { id: 'domains', label: 'ドメイン' },
  { id: 'objects', label: 'アクター' },
  { id: 'layouts', label: 'シーン' },
  { id: 'specs', label: '仕様' },
] as const;
export type ProjectTab = typeof PROJECT_TABS[number]['id'];
const VISIBLE_TAB_COUNT = 4;

export function ProjectTabs({ tab, onChange }: {
  tab: ProjectTab; onChange: (tab: ProjectTab) => void;
}): React.ReactElement {
  const details = React.useRef<HTMLDetailsElement>(null);
  const [order, setOrder] = React.useState<ProjectTab[]>(() => PROJECT_TABS.map((item) => item.id));
  const visibleIds = order.slice(0, VISIBLE_TAB_COUNT);
  // Memoria 同様、選択中のタブは必ず4枠内に置く。
  if (!visibleIds.includes(tab)) visibleIds[VISIBLE_TAB_COUNT - 1] = tab;
  const visible = visibleIds.flatMap((id) => PROJECT_TABS.filter((item) => item.id === id));
  const overflow = PROJECT_TABS.filter((item) => !visibleIds.includes(item.id));
  React.useEffect(() => {
    if (details.current) details.current.open = false;
  }, [tab]);
  return <nav className="tabbar project-tabs" aria-label="プロジェクトメニュー">
    {visible.map((item) => <button key={item.id}
      type="button" className={`tab ${tab === item.id ? 'active' : ''}`}
      aria-current={tab === item.id ? 'page' : undefined} onClick={() => onChange(item.id)}>
      {item.label}
    </button>)}
    <details ref={details} className="project-tabs-more" onKeyDown={(event) => {
      if (event.key === 'Escape' && details.current) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
      <summary className={`tab ${overflow.some((item) => item.id === tab) ? 'active' : ''}`}>その他</summary>
      <div className="project-tabs-menu">
        {overflow.map((item) => <button key={item.id} type="button"
          className={`tab ${tab === item.id ? 'active' : ''}`}
          aria-current={tab === item.id ? 'page' : undefined} onClick={() => {
            setOrder((current) => [item.id, ...current.filter((id) => id !== item.id)]);
            onChange(item.id);
            if (details.current) details.current.open = false;
          }}>{item.label}</button>)}
      </div>
    </details>
  </nav>;
}
