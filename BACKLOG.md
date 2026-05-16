# Praeforma — Backlog

2026-05-16 更新。 凍結解除後の一気通貫実装 (Step 1-7 + 1.5 + 1.6 + 10 + 12 + 13)
が完了したフェーズの残課題インデックス。

## 仕様 stub (spec/ 配下、 実装に合わせて更新済)

| # | 項目 | spec | 状態 |
|---|---|---|---|
| S1 | API 契約 (REST + WS) | [spec/api/README.md](spec/api/README.md) | ✅ 実装ベースで起稿 |
| S2 | acceptance event 形式 + pattern DSL | [spec/acceptance-script.md](spec/acceptance-script.md) | ✅ Step 12 と同期 |
| S3 | MVP 実装の着手順 | [spec/mvp-plan.md](spec/mvp-plan.md) | ✅ Step 1-7+ done に更新 |
| S4 | CLI 整備 | [spec/cli.md](spec/cli.md) | 設計完了、 v0.2 で実装 |
| S5 | 既存ツール (Notion + Figma + Unity) との差分 | [spec/competitive.md](spec/competitive.md) | ✅ 実装ベースで整理済 |

## 外部依存 (別リポ Issue)

| # | 項目 | リポ | 状態 |
|---|---|---|---|
| X1 | `Pf = Praeforma` を PROJECT-CODES.md に追記 | LUDIARS/LUDIARS | ✅ PR #9 で close |

## 完了済 step (= 凍結解除セッション)

- ✅ Step 1: server scaffold (Hono + Drizzle + pg + Cernere PASETO + migrations/001)
- ✅ Step 1.5: references + Melpomene 互換 feedback (migrations/002 + 2 routes)
- ✅ Step 1.6: Unity UPM v0.1 (Editor Window + Runtime gizmo)
- ✅ Step 2: REST CRUD core 5 (projects/domains/objects/layouts/specs + audit + 楽観ロック)
- ✅ Step 3: frontend scaffold (Vite + React 19 + Router 7 + TanStack Query)
- ✅ Step 4: 配置 editor 2D MVP (Canvas + drag/resize + Ctrl+Z + save)
- ✅ Step 5: WebSocket collab v1 (/ws/edit + presence + op broadcast + ping)
- ✅ Step 6: 3D preview (three.js with mouse-orbit camera)
- ✅ Step 7: acceptance v1 (runs/results CRUD + probe-driven assertion)
- ✅ Step 10: asset storage scaffold (presign stub + assets CRUD + object_assets link)
- ✅ Step 11: role 権限実装 (requireRole + lock_transform で動作)
- ✅ Step 12: acceptance event level (ringbuffer + sequence/count/within pattern)
- ✅ Step 13: reference webview/markdown (Notion/Confluence/GoogleDocs proxy)

## 残課題 (= 実環境 / 外部依存系)

| 項目 | 備考 |
|---|---|
| Postgres 立ち上げ + migrations 適用 | `LUDIARS/infra` の docker-compose + `npm run migrate` |
| Cernere project key 発行 (= praeforma) | Cernere 側で project + machine identity 登録 |
| Unity Editor 実機テスト | Unity プロジェクトを開いて Window > LUDIARS > Praeforma |
| WebSocket collab を 2 ブラウザ並べて確認 | 同一 project + 同一 layout で edit_ops broadcast |
| acceptance probe を Web 側 / Unity 側で実装 (= Step 9 残り) | runtime 側 from-scratch のため別フェーズ |
| MinIO/S3 adapter 実装 | StubStorageSource を実 S3 adapter に差替 (v0.2) |
| `praeforma` CLI 実装 | spec/cli.md ベース (v0.2) |
| Notion/Google/Confluence token を Infisical に登録 | env-cli で各サイトの token 入れる |

## 優先度評価 (4 軸、 凍結解除後の中間時点)

| 軸 | 評価 |
|---|---|
| AI 学習量 | 中-高 (= Drizzle + WebSocket + three.js + Unity UPM の合わせ技) |
| 作業コスト | scaffold 段階は完了、 dogfooding コストはまだ |
| 目的達成度 | 中 (= 1 project を実際に触れば feedback / spec / placement が回る) |
| 主目的との一致度 | 中 (= 個別プロジェクト支援、 LUDIARS 中心とは直交) |

= 「実環境を立てて dogfooding する」 フェーズに入った。
