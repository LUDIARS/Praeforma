# mvp-plan — MVP 実装の着手順

「Web + Unity の 2 系統」 を MVP とするが、 順番と minimum scope を決める。

## ステータス

**未起稿** (= backlog S3)。 schema が決まったので、 着手前に order を確定する。

## 候補 (draft)

### 着手順 案 1: backend-first (推奨)

1. **server scaffold** — Hono + Drizzle + Postgres、 migrations 001、 auth (Cernere composite)
2. **REST CRUD** — projects / domains / objects / layouts / specs (= core 5 tables)
3. **frontend scaffold** — React + Vite + backend client
4. **配置 editor (2D 単体)** — 配置 + spec 編集 + 紐付け (= 「画面で動くもの」 最初の節目)
5. **WebSocket collab** — edit_ops broadcast (= 2 人で同時編集できる)
6. **3D preview (WebGL)** — three.js で placeholder 3D 配置 + camera
7. **acceptance v1** — manual + assertion level、 runtime probe
8. **Unity UPM** — Editor 拡張で project open + placeholder 配置 + Prefab assign
9. **Unity Runtime probe** — acceptance を Unity 側でも回せる
10. **asset storage (MinIO/S3)** — pre-signed URL upload + object_assets link
11. **role 権限実装** — server middleware + UI 反映
12. **acceptance event level** — event ringbuffer + pattern matcher

### 着手順 案 2: ux-first

1. frontend prototype (= 紙芝居) で UX 確定 → backend 設計
- 利点: 触れる UI が早く出る → ヒアリングしやすい
- 欠点: backend がボトルネックになりがち、 結局 1 から組み直す可能性

### 推奨 = 案 1

backend が安定すると frontend / unity が並列実装できるので、 結局 cycle が早い。

## 各 step の DoD (Done の定義) ドラフト

- Step 1 (server scaffold): `npm run dev` で起動 + healthz + Cernere login が通る
- Step 4 (配置 editor): 1 project 作成 → object 5 個配置 → spec 3 個書く → 保存 + 復帰
- Step 5 (collab): 2 ブラウザで同時編集して破綻しない
- Step 7 (acceptance v1): SPEC-001 を assertion level で pass / fail 判定できる
- Step 8 (Unity): UPM 入れて Window 開き、 project 一覧 → 選択 → Scene 生成

## 規模感

- Step 1-4 (backend + 最低限 frontend): 5 - 10 日 (= AI 集中投入時)
- Step 5-8: 10 - 15 日
- Step 9-12: 10 - 15 日
- 合計 25 - 40 日 (= 他作業と並行なら数か月)

## 関連
- §5 platform 別実装 (praeforma.md)
- §12 collaboration (praeforma.md)
- BACKLOG.md
