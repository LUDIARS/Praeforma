/**
 * 概要タブのTODO一覧。 コア↔ビジネスドメインのつながりを、 解決する場所であるドメインタブへ
 * `?tab=domains&focus=<ドメイン名>` で渡す (spec/feature/ux-definition-todos.md)。
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { DefinitionTodoList } from './ux-design/DefinitionTodoList.tsx';
import { FragmentCleanupTodo } from './specs/FragmentCleanupTodo.tsx';

export function ProjectTodos({ pid }: { pid: string }): React.ReactElement {
  const navigate = useNavigate();
  return <>
    <FragmentCleanupTodo pid={pid} />
    <DefinitionTodoList projectId={pid} onOpen={(todo) => {
      const params = new URLSearchParams({ tab: 'domains' });
      if (todo.domainId) params.set('focus', todo.name);
      navigate(`/projects/${pid}?${params}`);
    }} />
  </>;
}
