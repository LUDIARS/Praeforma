---
title: LUDIARS 9-tool design review — Praeforma
type: plan
status: proposed
updated: 2026-10-17
---

# Praeforma: authoritative design with revision-bound implementation evidence

Pf owns structured requirements, UX/core design, data design and specification
versions. Each repository's spec/ux remains authoritative for its product UX; a
linked Pf view must not become a competing editable copy. An owns analysis,
Augur test execution evidence, Actio tasks, Cc coordination, Rv review/merge,
Br summaries, Genius judgments and Cf game adoption. LLM-authored UX stays draft.

Reviewed main 7c93ed9: CLAUDE.md, README.md, package.json,
excubitor.catalog.yaml, server/src/local.ts, server/bootstrap.ts.
The current personal catalog builds both web and server, then launches compiled
local.js in SQLite mode without Cernere. The old contributor note said web did
not exist and presented bootstrap/Postgres/auth as the only architecture.
Implemented bounded corrections to that note. Separate multi-user auth and
additive migration constraints are retained; no runtime security policy changed.

## Priorities and counterarguments

1. Align UX/use-case/domain/spec identities before adding automatic copying between
   tools. Acceptance: source owner and revision are explicit; a linked repository
   UX document is referenced, not silently overwritten by a generated Pf copy.
2. Connect An implementation and Augur evidence as revision-bound projections.
   Acceptance: stale, skipped, uncovered and executed-pass remain distinct; a
   successful merge does not invent human UX approval or complete implementation.
3. Preserve fragment ingestion versus reconstruction as different operations.
   README explicitly keeps automated reconstruction/Cc registration as later work;
   don't report those integrations complete merely because fragments can be stored.
4. Share read-only summaries with Br and task references with Actio. Cc should
   coordinate work without becoming a second requirements store. Genius advice
   can inform a design decision but must retain its provenance and human authority.

Large automatic import/reconstruction and cross-service writes remain proposals
until ownership, version conflicts, request identity and recovery are specified.
No performance measurement or end-to-end implementation/UX approval is claimed.

Validation: source and document consistency, git diff --check. Tests, startup,
database operations and deployment were not run. Recovery: revert documents;
no migration, credential or service operation is required.
