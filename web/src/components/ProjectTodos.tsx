/**
 * 概要タブのTODO一覧。既存シナリオは `?scenario=`、未定義項目は `?todo=&name=` で
 * UXデザインへ渡す (spec/feature/ux-core-design.md「画面の入口」、
 * spec/feature/project-registration.md)。クリックだけではシナリオを登録しない。
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { uxDesignApi } from '../lib/ux-design-api.ts';
import { DefinitionTodoList } from './ux-design/DefinitionTodoList.tsx';
import { FragmentCleanupTodo } from './specs/FragmentCleanupTodo.tsx';

export function ProjectTodos({ pid }: { pid: string }): React.ReactElement {
  const navigate = useNavigate();
  const scenarios = useQuery({ queryKey: ['ux-scenarios', pid], queryFn: () => uxDesignApi.listScenarios(pid) });
  return <>
    <FragmentCleanupTodo pid={pid} />
    {scenarios.isError && <p role="alert">シナリオとの対応を取得できませんでした。
      <button type="button" disabled={scenarios.isFetching} onClick={() => { void scenarios.refetch(); }}>再取得</button>
    </p>}
    <DefinitionTodoList projectId={pid} scenarios={scenarios.data?.items ?? []} canOpen={scenarios.isSuccess}
      onOpen={(id) => navigate(`/projects/${pid}/ux-design?${new URLSearchParams({ scenario: id })}`)}
      onDefine={(todo) => navigate(`/projects/${pid}/ux-design?${new URLSearchParams({ todo: todo.ref, name: todo.name.slice(0, 200) })}`)} />
  </>;
}
