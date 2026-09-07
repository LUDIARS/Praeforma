# Cc cannot bind a sandbox-owned Praeforma worktree

- Date: 2026-09-07
- Status: unresolved
- Area: Concordia implementation registration / Revisor submission boundary
- Severity: blocks implementation registration and worktree-based submission

## Summary

During Praeforma implementation, Cc rejected registration of the task worktree
because Git detected ownership by CodexSandboxOffline while Cc runs as the
operator account. This is a recurring cross-account integration failure.
The report is retained in the affected Praeforma branch; the primary fix owner
is Concordia, with Revisor as the reference for managed Git trust handling.

## Evidence

- Task branch: `feat/ux-design-contracts-20260907`.
- Worktree: `E:/Document/Ars/.wt-Praeforma-ux-design-contracts`.
- Lictor task registration succeeded, but `/v1/implementation-tools/bind`
  returned an outer HTTP 500 containing Cc HTTP 409
  `{"error":"implementation_bind_failed"}`.
- Read-only `git status --short` under the operator account returned
  `fatal: detected dubious ownership in repository` and identified the
  worktree `.git` file owner as `CodexSandboxOffline`, versus operator `raury`.
- A proposed exact-path `git config --global --add safe.directory` was rejected
  by automatic approval review because persistent global trust changes require
  explicit authorization. The change was not executed. No wildcard or alternate
  trust-setting workaround was applied.

## Regression Context

Existing Concordia logs contain the same ownership failure for Anatomia and
Lictor task worktrees. Revisor already documents this class of problem in
`spec/plan/problem_logs/2026-08-09-dubious-ownership-blocked-merge.md` and
`spec/plan/problem_logs/2026-08-09-merge-repository-source-ownership.md`.

## Cause

Concordia `src/implementation-tools/repo-context.ts` invokes plain
`git -C <cwd>` when inspecting the worktree. Its API router
`src/api/implementation-tools.ts` converts all bind exceptions to the same
409 response, hiding the actionable ownership error. Lictor wraps it in 500.
Revisor's `spec/feature/managed-git-runtime.md` describes command-scoped trust
and separately controlled local-transport trust without modifying the user's
global configuration. This incident failed before reaching that Rv boundary.

## Fix Requirements

- Cc should validate repository provenance and workspace containment, then use
  a bounded managed Git mechanism consistent with Revisor for cross-account
  worktree inspection. Do not require sessions to mutate user global trust.
- Preserve explicit branch and actual worktree binding; do not silently register
  the main checkout as though it were the task worktree.
- Return an actionable typed ownership error instead of generic bind failure.
- Keep wildcard trust, arbitrary external repositories, and global Git settings
  outside the remedy.
- Audit Cc direct-submission Git inspection for the same failure.

## Verification

Only source inspection, existing logs, Git metadata, ACL reads, and read-only
Git status were used. No unit, integration, behavior, or startup tests ran.
Future authorized regression coverage should exercise sandbox-owned linked
worktrees under a service account, correct branch/path binding, unknown-source
rejection, local clone/fetch children, and unchanged operator Git configuration.

## Follow-up

Submit the existing Praeforma branch through the supported explicit-branch API
from its registered repository. Track Cc's correction separately from Praeforma
product implementation. This report does not claim the ownership problem fixed.
