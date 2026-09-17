# PF-UNITY-EDITOR: Unity Editor specifications and instructions

SPEC-PF-UNITY-EDITOR (PF-UNITY-EDITOR), 2026-09-17 neco instruction. The user can read a selected project's
specifications and save a request beside the Unity object being edited. Losing the
project/selection association or an unsent instruction is a failure (UX-PF-UNITY-1).

The existing Praeforma UPM package owns Editor UI, selected Pf project, HTTP access
and instruction drafts. Tela owns generic rendering and Scene geometry/input bridge.
The optional Praeforma.Tela package adapts an explicit connection interface to Tela;
the base Editor window works without that package. Pf credentials never enter Tela.

Specifications are read through the existing project-scoped `/specs` API in pages.
Project changes clear prior results; late responses cannot replace the current page.
Instructions are immutable `/spec-fragments` input, not executable C# or shell text.
The user's text and captured Unity object identity are stored together. A draft is
scoped to the selected backend/project. On first send it freezes a UUID and payload;
unknown outcomes retry the same UUID and bytes. Editing a frozen request requires a
new draft, so a retry cannot silently change the meaning of an accepted request.
The server's role checks and source-event deduplication remain authoritative.

Drafts survive Editor window close and domain reload through SessionState. This is
session persistence, not a claim that drafts survive a full Unity Editor shutdown.
The UI reports save errors and the returned fragment ID. Saving does not mean an AI
has executed the request. AI dispatch and remote commands to Unity are separate work.

Connection mode is explicit: authenticated backend, or local loopback backend without
a token. No authentication failure causes an automatic downgrade. Local mode rejects
non-loopback addresses. New HTTP requests have timeouts and owned request cleanup.

Optional Tela connection only attaches an already running, correctly configured native
overlay to the active Scene view. Overlay process startup remains in Excubitor. Pf's
existing export workflow supplies its scene/spec/graph content. This package does not
launch a native executable or embed HWND content inside Unity's EditorWindow.

Acceptance: request snapshot/deduplication contracts; page/project switch; failure
preserves draft; optional package absent; Scene connect/disconnect/reload. Compilation
does not substitute for Unity/Pf/native end-to-end acceptance.
