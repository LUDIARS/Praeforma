# mvp-plan — MVP 実装の着手順

「Web + Unity の 2 系統」 を MVP とするが、 順番と minimum scope を決める。

## ステータス

**実装着手用に詰めた版** (2026-05-16)。 schema が決まったので、 着手前に order を確定する。

## 推奨方針 — backend-first

backend が安定すると frontend / unity が並列実装できるので、 結局 cycle が早い。
ux-first (= 紙芝居 prototype) は backend がボトルネックになりがちで、 1 から
組み直す可能性があるため見送り。

---

## 全体ロードマップ (14 step、 累計 30-50 日)

2026-05-16 改訂: ユーザ指示で Unity UPM (= 旧 Step 8) を v0.1 段階に前倒し、
references / feedback を独立 step として追加。

| # | Step | 状態 | 規模感 | 主成果物 |
|---|------|------|--------|---------|
| 1 | server scaffold | ✅ done | 1-2 日 | Hono + Drizzle + Postgres + Cernere PASETO + healthz |
| 1.5 | references + feedback (= 追加) | ✅ done | 1 日 | Notion 等 doc リンク + Melpomene 互換 FB |
| 1.6 | Unity UPM v0.1 (= Step 8 前倒し) | ✅ done | 1 日 | Editor Window + placeholder + FB gizmo + reference open-in-browser |
| 2 | REST CRUD (core 5) | 🟡 | 3-5 日 | projects / domains / objects / layouts / specs |
| 3 | frontend scaffold | 🟡 | 1-2 日 | React + Vite + auth + project list |
| 4 | 配置 editor (2D 単体) | 🟡 | 3-5 日 | placeholder 配置 + spec 編集 + 保存復帰 |
| 5 | WebSocket collab | 🟡 | 3-5 日 | edit_ops broadcast + LWW + presence |
| 6 | 3D preview (WebGL) | 🟡 | 3-5 日 | three.js + camera + placeholder 3D |
| 7 | acceptance v1 | 🟡 | 3-5 日 | manual + assertion level + runtime probe |
| 8 | Unity UPM v0.2 (layout 同期) | 🟡 | 2-3 日 | Praeforma layout を Scene に流し込み + Prefab 差替 |
| 9 | Unity runtime probe | 🟡 | 2-3 日 | acceptance を Unity 側でも回す |
| 10 | asset storage | 🟡 | 2-3 日 | MinIO/S3 + pre-signed URL + object_assets |
| 11 | role 権限実装 | 🟡 | 2-3 日 | server middleware + UI 反映 |
| 12 | acceptance event level | 🟡 | 3-5 日 | event ringbuffer + pattern matcher |
| 13 | reference webview/markdown | 🟡 | 2-3 日 | Notion/Confluence/Google API 取得 + 表示 |

---

## Step 1.5: references + feedback (2026-05-16 追加)

### 着手 task

- `spec/schema/reference.md` — 外部 doc リンク (Notion/Confluence/Google 等)
- `spec/schema/feedback.md` — Melpomene 互換のシーン FB + comments
- `server/migrations/002_refs_feedback.sql` — external_references + object_feedback + feedback_comments
- `server/src/db/schema/{reference,feedback}.ts` — Drizzle 定義
- `server/src/routes/references.ts` — `/api/projects/:pid/references` (GET/POST/DELETE)
- `server/src/routes/feedback.ts` — `/api/projects/:pid/feedback` (GET/POST/PATCH + :id/comments)

### DoD

- `external_references` テーブルに INSERT → GET で取得できる
- `object_feedback` を Web から登録 → Unity Editor で表示できる (Step 1.6 と連動)
- comment 追加で `feedback_comments` に行が増える

## Step 1.6: Unity UPM v0.1 (2026-05-16 追加、 旧 Step 8 前倒し)

### 着手 task

- `Packages/jp.ludiars.praeforma/` UPM パッケージ
- Runtime: `PraeformaPlaceholder` (gizmo) + `FeedbackMarker` (Melpomene 互換 gizmo)
- Editor:
  - 4 タブ Editor Window (Login / Projects / Feedback / References)
  - PASETO token を EditorPrefs に保存
  - UnityWebRequest API client (JsonUtility 互換 DTO)
  - References は `Application.OpenURL` で OS ブラウザ起動 (v0.1 は link のみ)
- spec/unity-editor.md

### DoD

- Editor Window > LUDIARS > Praeforma が開く
- Login タブで base URL + PASETO を保存 → Test Connection が成功
- Projects タブで一覧表示 + Activate
- Scene で `PraeformaPlaceholder` を持つ GameObject を選択 → Feedback タブで
  紐付き FB を表示 + 新規投稿可能
- References タブで domain の外部 doc リンクを表示 + Open in Browser

詳細: `spec/unity-editor.md`

## Step 1: server scaffold

### 着手 task

- `package.json` (npm workspaces で `server/` と `web/` を切る) + ルート tsconfig
- `server/package.json`: Hono + Drizzle ORM + better-sqlite3 (dev) or pg (本番) + tsx + esbuild
- `server/src/index.ts` (Hono entry、 healthz only)
- `server/src/db/connection.ts` (Drizzle + Postgres pool)
- `server/src/db/schema/` 配下に 8 ドメインの Drizzle table 定義
  (project / domain / object / layout / spec / asset / acceptance / collab)
- `server/migrations/001_init.sql` (= schema 一括 init、 Cernere の冪等ルール準拠)
- `server/src/auth/cernere.ts` (PASETO V4 検証、 公開鍵 6h refresh、 Memoria の
  `multi/paseto-verifier.js` を Drizzle 流に移植)
- `server/src/middleware/require-auth.ts` + `require-role.ts`
- `env-cli.config.ts` (Bibliotheca 同様) + `server/src/lib/env-bootstrap.ts`
- `server/bootstrap.ts` (Infisical fetch → index 起動)

### DoD

- `docker compose up -d` (= LUDIARS shared infra) で Postgres 起動
- `npm run dev` で `http://localhost:<PORT>/api/health` が `{"ok":true}`
- Cernere base URL を env に設定 → `GET /api/health` で `[auth] public keys
  refreshed: +N` ログが出る (公開鍵 fetch 成功)
- `migrations/001_init.sql` を実行 → `\dt` で 12 table 程度が出る

---

## Step 2: REST CRUD (core 5)

### 着手 task

- `server/src/routes/projects.ts` — `/api/projects` (list/get/create/update/delete) + `/api/projects/:id/members`
- `server/src/routes/domains.ts` — `/api/projects/:pid/domains`
- `server/src/routes/objects.ts` — `/api/projects/:pid/objects` + `/object_attrs`
- `server/src/routes/layouts.ts` — `/api/projects/:pid/layouts` + `layout_objects` + `cameras`
- `server/src/routes/specs.ts` — `/api/projects/:pid/specs` + `spec_targets` + `spec_acceptance`
- `server/src/db/repository/` — テーブル毎の facade。 ルートから ORM 直叩き禁止
- `server/src/validation/` — Zod スキーマ (REST 入力検証)
- 各 route に `requireAuth` + 必要な `requireRole` (= F2 role モデル)
- `server/src/lib/errors.ts` (LUDIARS 標準: `{ error, detail? }` + HTTP code)
- `server/src/lib/pagination.ts` (`?limit=&offset=`、 既定 50 / max 200)

### DoD

- 5 領域すべてで CRUD が curl で通る (`POST /api/projects` で作成 → `GET` 一覧 → 個別 → `PATCH` → `DELETE`)
- 楽観ロック競合は `409 Conflict` を返し、 body に server version を含む
- role 不足は `403`、 認証なしは `401`
- pagination が機能する (`limit=10 offset=20` で正しい range が返る)
- audit_log にすべての破壊的操作が積まれる

---

## Step 3: frontend scaffold

### 着手 task

- `web/package.json` (Vite + React 19 + React Router 7 + TanStack Query)
- `web/src/lib/api-client.ts` (Bearer token 付き fetch + 型安全 wrapper)
- `web/src/lib/auth.ts` (Cernere login redirect + token 保管 + refresh)
- `web/src/pages/Login.tsx` (Cernere redirect)
- `web/src/pages/ProjectList.tsx` (`GET /api/projects` 表示 + 作成)
- `web/src/pages/ProjectShow.tsx` (project meta + member 一覧)
- Foundation UI (Memoria の `.foundation-form` ベース、 Bibliotheca と同レベルで移植)
- `web/index.html` + PWA manifest (将来用、 v0.1 では required ではない)

### DoD

- `npm run dev` で `http://localhost:<WEB_PORT>` が開く
- 未認証で `/` を開くと Cernere ログイン画面に飛ぶ
- ログイン後 project 一覧が出る、 「新規作成」 で project が作れる
- 個別 project を開いて name + description + member が見える

---

## Step 4: 配置 editor (2D 単体)

### 着手 task

- `web/src/pages/LayoutEditor.tsx` — 2D 配置 editor 本体 (split view)
- `web/src/components/Canvas2D.tsx` — `<canvas>` ベースの placeholder 描画 +
  ドラッグ移動 + リサイズ + 回転 + スナップ + undo/redo
- `web/src/components/ObjectList.tsx` — 左ペイン: ドメイン別 object ツリー
- `web/src/components/SpecPanel.tsx` — 右ペイン: 該当 object の spec 編集
  (YAML frontmatter + Markdown、 リアルタイム validation)
- `web/src/components/DomainPalette.tsx` — domain を drag-and-drop で
  新規 object 化
- `web/src/hooks/useLayoutOps.ts` — 配置編集を `EditOp` の列で表現
  (= Step 5 で WS 化する基礎、 v0.1 ではローカル applyのみ)
- 配置の保存 = `PATCH /api/projects/:pid/layouts/:lid` で `layout_objects` 一括更新

### DoD

- 1 project 作成 → object 5 個配置 (= domain ごとの色違い placeholder で) →
  spec 3 個書く → 保存 (reload しても復帰)
- Ctrl+Z / Ctrl+Shift+Z で undo / redo が 50 step ぶん効く
- spec 編集が保存時にバリデーション (= id 重複 / target 参照切れ) を表示

---

## Step 5-12 概要 (詳細は別 spec で順次)

- **Step 5**: WS edit_ops broadcast + field-level LWW + presence cursor
- **Step 6**: three.js で 3D placeholder + camera + Y-up / Z-up 切替
- **Step 7**: acceptance v1: manual checkbox + assertion (= probe + JS 式評価)
- **Step 8**: Unity UPM `Packages/jp.ludiars.praeforma/` + Editor Window
- **Step 9**: Unity Runtime に acceptance probe 実装 + WS で server へ event 送信
- **Step 10**: MinIO/S3 連携 (Curare と同様の pre-signed URL upload)
- **Step 11**: server middleware で role 制限を厳密化 + UI で disabled / hidden
- **Step 12**: event level acceptance (ringbuffer + within/sequence/count パターン)

---

## DoD まとめ表 (節目だけ)

| Step | DoD |
|---|---|
| 1 (server scaffold) | `npm run dev` で起動 + `/api/health` + Cernere 公開鍵 fetch 成功 |
| 2 (REST CRUD) | core 5 領域 CRUD が curl で通る + audit log 蓄積 + role 検査 |
| 4 (配置 editor) | 1 project + 5 objects + 3 specs を作成 → 保存 → reload で復帰 |
| 5 (collab) | 2 ブラウザで同時編集して破綻しない |
| 7 (acceptance v1) | SPEC-001 を assertion level で pass / fail 判定できる |
| 8 (Unity) | UPM 入れて Window 開き、 project 一覧 → 選択 → Scene 生成 |

---

## 規模感

- Step 1-4 (backend + 最低限 frontend): 5 - 10 日 (= AI 集中投入時)
- Step 5-8: 10 - 15 日
- Step 9-12: 10 - 15 日
- 合計 25 - 40 日 (= 他作業と並行なら数か月)

---

## 関連

- §5 platform 別実装 (praeforma.md)
- §12 collaboration (praeforma.md)
- BACKLOG.md
- spec/api/README.md
- spec/schema/ (1 ドメイン 1 ファイル、 計 11 文書 — reference / feedback 追加済)
- spec/unity-editor.md (Step 1.6 / Step 8 / Step 9 詳細)
