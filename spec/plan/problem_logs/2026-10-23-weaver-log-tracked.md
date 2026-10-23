# server/logs/weaver.jsonl was tracked and made PRs conflict

- Date: 2026-10-23
- Status: resolved (branch `fix/untrack-weaver-log`)
- Area: repository hygiene / runtime logs
- Severity: every Revisor review appended to a tracked file, so concurrent PRs conflicted
- Tasks: actio:e859e2cd-ff11-471f-b6f4-7e54c3e9865f (fix), Actio 24dc38c2-15c0-4a34-b9b8-c8db45e122ca (bug report)

## Summary

`server/logs/weaver.jsonl` is the default JSONL sink of `@ludiars/log-weaver`
(`fileJsonlSink`, `${VESTIGIUM_LOGS_DIR ?? cwd/logs}/weaver.jsonl`). The server
runs with cwd `server/`, so contract observations from reviews and server starts
were appended to `server/logs/weaver.jsonl`, which had been committed. The root
`.gitignore` only ignored `*.log`, which does not match `.jsonl`.

## Fix

- `server/logs/` is added to the root `.gitignore`.
- `server/logs/weaver.jsonl` is removed from the index with `git rm --cached`
  (the local file is kept).
- The writer already runs `mkdirSync(dir, { recursive: true })` before the first
  append, so a missing `server/logs/` is recreated. No writer change was needed.
- `server/src/lib/__tests__/weaver-log-untracked.test.ts` checks that the path is
  ignored and untracked, and that the default sink creates a missing logs directory.

## Recovery

Revert the commit to track the file again. Existing local copies of
`server/logs/weaver.jsonl` stay on disk after pulling this change.

## Other tracked runtime files (not changed here)

- `.augur/tests.jsonl` — Augur test plan/run records under the repo root.
- `logs/lictor/2026-06-25.jsonl` — a Lictor session log committed under root `logs/`.
