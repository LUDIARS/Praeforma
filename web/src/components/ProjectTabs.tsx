import React from 'react';
import { Link } from 'react-router';
import '../styles/project-tabs.css';

const PROJECT_TABS = [
  { id: 'overview', label: '概要' },
  { id: 'ux-goal', label: 'UX/ゴール' },
  { id: 'domains', label: 'ドメイン' },
  { id: 'objects', label: 'アクター' },
  { id: 'layouts', label: 'シーン' },
  { id: 'specs', label: '仕様' },
  { id: 'data-design', label: 'データ設計' },
  { id: 'flow-diagram', label: '遷移図' },
] as const;
export type ProjectTab = typeof PROJECT_TABS[number]['id'];
const VISIBLE_TAB_COUNT = 4;

export function parseProjectTab(value: string | null): ProjectTab {
  return PROJECT_TABS.find((item) => item.id === value)?.id ?? 'overview';
}

export function ProjectTabs({ pid, tab, onChange }: {
  pid: string; tab: ProjectTab; onChange: (tab: ProjectTab) => void;
}): React.ReactElement {
  const moreButton = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);
  const [order, setOrder] = React.useState<ProjectTab[]>(() => PROJECT_TABS.map((item) => item.id));
  const visibleIds = order.slice(0, VISIBLE_TAB_COUNT);
  // Memoria 同様、選択中のタブは必ず4枠内に置く。
  if (!visibleIds.includes(tab)) visibleIds[VISIBLE_TAB_COUNT - 1] = tab;
  const visible = visibleIds.flatMap((id) => PROJECT_TABS.filter((item) => item.id === id));
  const overflow = PROJECT_TABS.filter((item) => !visibleIds.includes(item.id));
  React.useEffect(() => {
    setIsMoreOpen(false);
  }, [tab]);
  return <nav className="tabbar project-tabs" aria-label="プロジェクトメニュー">
    {visible.map((item) => <button key={item.id}
      type="button" className={`tab ${tab === item.id ? 'active' : ''}`}
      aria-current={tab === item.id ? 'page' : undefined} onClick={() => onChange(item.id)}>
      {item.label}
    </button>)}
    <div className="project-tabs-more" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        moreButton.current?.focus();
      }
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsMoreOpen(false);
    }}>
      <button ref={moreButton} type="button" className="tab"
        aria-expanded={isMoreOpen} aria-haspopup="menu" aria-controls={isMoreOpen ? menuId : undefined}
        onClick={() => setIsMoreOpen((current) => !current)}>その他</button>
      {isMoreOpen && <div id={menuId} className="project-tabs-menu" role="menu">
        {overflow.map((item) => <button key={item.id} type="button" role="menuitem"
          className="tab" onClick={() => {
            setOrder((current) => [item.id, ...current.filter((id) => id !== item.id)]);
            onChange(item.id);
            setIsMoreOpen(false);
          }}>{item.label}</button>)}
        <Link to={`/projects/${pid}/studio`} role="menuitem" className="tab"
          style={{ textDecoration: 'none' }} onClick={() => setIsMoreOpen(false)}>
          要件定義モード
        </Link>
      </div>}
    </div>
  </nav>;
}
