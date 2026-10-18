import React from 'react';
import { useMutation } from '@tanstack/react-query';
import type { SpecSprint } from '../../../../shared/spec-sprints.ts';
import { sprintApi, sprintError } from '../../lib/spec-sprints-api.ts';

/** PF-SPRINT-1: name a check unit; fragments are added from the sprint itself. */
export function SprintCreateForm({ pid, onCreated }: {
  pid: string; onCreated: (sprint: SpecSprint) => Promise<void>;
}): React.ReactElement {
  const [title, setTitle] = React.useState('');
  const [goal, setGoal] = React.useState('');
  const create = useMutation({
    mutationFn: () => sprintApi.create(pid, { title, goal }),
    onSuccess: async ({ sprint }) => { setTitle(''); setGoal(''); await onCreated(sprint); },
  });
  return <form onSubmit={(event) => { event.preventDefault(); if (title.trim() && !create.isPending) create.mutate(); }}>
    <fieldset className="fragment-fields" disabled={create.isPending}>
      <label>スプリント名<input value={title} maxLength={200} required onChange={(event) => setTitle(event.target.value)} /></label>
      <label>狙い (任意)<textarea rows={2} maxLength={2000} value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
      <div><button type="submit" className="primary" disabled={!title.trim()}>{create.isPending ? '作成中…' : 'スプリントを作成'}</button></div>
    </fieldset>
    {create.isError && <p role="alert">{sprintError(create.error)}</p>}
  </form>;
}
