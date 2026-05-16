# Changelog

## 0.1.0 (2026-05-16)

### Added

- Initial scaffold of Praeforma Unity Editor extension (UPM package)
- 4-tab Editor Window: Login / Projects / Feedback / References
- Runtime components:
  - `PraeformaPlaceholder` — gizmo for placeholder shape + color
  - `FeedbackMarker` — Melpomene-compatible scene FB pin (球体 + 旗、 state 色分け)
- Editor Api: UnityWebRequest client + EditorPrefs auth storage
- Reference display via OS browser (`Application.OpenURL`)
- Feedback create from Scene selection with auto world_position

### Known limitations

- Reference `webview` / `markdown` display modes are stubs
- No project / layout / domain creation from Editor (Web UI only)
- PASETO token requires manual copy from Praeforma Web UI
