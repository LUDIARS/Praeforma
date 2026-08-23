// Screen Flow ページ: 3 ペイン (ツリー / 画面の UI 要素 + 遷移先 / トークエリア) + 下段タブ
// (遷移図 / 仕様書 / ドメイン / Cc 状態)。 spec/feature/screen-flow.md §5.1 / §8。
//
// @spec 5.1 画面構成

import React from 'react';
import { useParams, Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { screenFlowApi, errorText } from '../lib/screen-flow-api.ts';
import { ScreenTree } from '../components/flow/ScreenTree.tsx';
import { TalkArea } from '../components/flow/TalkArea.tsx';
import { FlowDiagram } from '../components/flow/FlowDiagram.tsx';
import { SpecPreview } from '../components/flow/SpecPreview.tsx';
import { AnatomiaPanel } from '../components/flow/AnatomiaPanel.tsx';
import { CcPanel } from '../components/flow/CcPanel.tsx';
import { TransitionEditor } from '../components/flow/TransitionEditor.tsx';
import { WidgetBoard } from '../components/flow/WidgetBoard.tsx';
import type { ScreenRow, Selection } from '../components/flow/types.ts';

type Tab = 'flow' | 'spec' | 'domains' | 'cc';

export function ScreenFlowPage(): React.ReactElement {
  const { pid = '' } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('flow');
  const [revision, setRevision] = React.useState(0);

  const projectQ = useQuery({ queryKey: ['project', pid], queryFn: () => api.getProject(pid) });
  const modelQ = useQuery({ queryKey: ['flow.model', pid, revision], queryFn: () => screenFlowApi.model(pid) });
  const transitionsQ = useQuery({ queryKey: ['transitions', pid, revision], queryFn: () => screenFlowApi.listTransitions(pid) });

  const projectName = modelQ.data?.projectName ?? projectQ.data?.project.name ?? 'project';
  const [selection, setSelection] = React.useState<Selection>({ kind: 'project', id: 'project', name: projectName });
  React.useEffect(() => {
    if (selection.kind === 'project' && selection.name !== projectName) setSelection({ kind: 'project', id: 'project', name: projectName });
  }, [projectName, selection]);

  const screens: ScreenRow[] = (modelQ.data?.screens ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    widgets: s.widgets.map((w) => ({ placementId: w.placementId, objectId: w.objectId, name: w.name, widget: w.widget, label: w.label })),
  }));
  const transitions = transitionsQ.data?.items ?? [];
  const bump = React.useCallback(() => {
    setRevision((r) => r + 1);
    qc.invalidateQueries({ queryKey: ['layouts', pid] });
  }, [qc, pid]);

  const addScreenM = useMutation({
    mutationFn: (name: string) => api.createLayout(pid, { name, kind: 'ui-2d' }),
    onSuccess: (res) => {
      bump();
      setSelection({ kind: 'layout', id: res.layout.id, name: res.layout.name });
    },
  });

  const screenName = (id: string) => screens.find((s) => s.id === id)?.name ?? id;
  const widgetName = (placementId: string | null) => {
    if (!placementId) return '(画面)';
    for (const s of screens) {
      const w = s.widgets.find((x) => x.placementId === placementId);
      if (w) return w.label ?? w.name;
    }
    return placementId;
  };
  const currentScreen =
    selection.kind === 'layout'
      ? screens.find((s) => s.id === selection.id)
      : selection.kind === 'object'
        ? screens.find((s) => s.widgets.some((w) => w.placementId === selection.id))
        : undefined;

  return (
    <div className="screen-flow">
      <div className="screen-flow-top">
        <Link to={`/projects/${pid}`}>← {projectName}</Link>
        <h2>Screen Flow</h2>
        <span className="muted">UI を仮置き → 遷移先を付ける → 会話で仕様を育てる → 遷移図 / 仕様書</span>
        {modelQ.isError ? <span className="error">{errorText(modelQ.error)}</span> : null}
      </div>
      <div className="screen-flow-panes">
        <aside className="pane pane-left">
          <ScreenTree
            projectName={projectName}
            screens={screens}
            transitions={transitions}
            selection={selection}
            onSelect={setSelection}
            onAddScreen={(name) => addScreenM.mutate(name)}
          />
        </aside>
        <section className="pane pane-center">
          {currentScreen ? (
            <>
              <WidgetBoard pid={pid} screen={currentScreen} selection={selection} onSelect={setSelection} onChanged={bump} />
              <TransitionEditor pid={pid} selection={selection} screens={screens} transitions={transitions} onChanged={bump} />
            </>
          ) : (
            <div className="muted pane-empty">左のツリーで画面を選ぶか、 画面を追加してください。 UI 要素を仮置きし、 要素に遷移先を付けると右下の遷移図に反映されます。</div>
          )}
        </section>
        <aside className="pane pane-right">
          <TalkArea pid={pid} selection={selection} screenName={screenName} widgetName={widgetName} onApplied={bump} />
        </aside>
      </div>
      <div className="screen-flow-bottom">
        <div className="tabs">
          {(
            [
              ['flow', '遷移図'],
              ['spec', '仕様書'],
              ['domains', 'ドメイン (Anatomia)'],
              ['cc', 'Cc 状態'],
            ] as Array<[Tab, string]>
          ).map(([k, label]) => (
            <button key={k} type="button" className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {tab === 'flow' ? <FlowDiagram pid={pid} revision={revision} /> : null}
          {tab === 'spec' ? <SpecPreview pid={pid} revision={revision} /> : null}
          {tab === 'domains' ? (
            <AnatomiaPanel pid={pid} anatomiaRepo={modelQ.data?.anatomiaRepo ?? null} onProjectChanged={bump} />
          ) : null}
          {tab === 'cc' ? <CcPanel pid={pid} selection={selection} /> : null}
        </div>
      </div>
    </div>
  );
}
