# Praeforma — Claude 向けメモ

## 性格

仕様書 ↔ 実装連携ツール。 LUDIARS の中では「他が落ち着いたら」 だった枠で、
2026-05-16 に凍結解除 → 実装フェーズに入った。

## 触ってよい / よくない

- 触ってよい: `server/`, `web/`, `spec/`, root `package.json`, README
- 触らない: 他リポ (Cernere / Memoria 等) — Praeforma は独立
- DB schema 変更: spec/schema/*.md を **正本** として更新 → Drizzle schema +
  migrations を順番に追加 (= 過去 migration は不可逆、 新 NNN ファイルで進める)

## アーキ要点

- 通常の Excubitor catalog は個人用 SQLite モード。`npm run build` が web と server をビルドし、`node server/dist/local.js` で起動する。
- `server/src/local.ts` がローカルモードを設定して `index.ts` を読む。このモードでは Cernere 認証は不要。
- `server/bootstrap.ts` / Postgres / Cernere PASETO の経路は別モード。個人用 catalog の起動経路と混同しない。
- DB 接続失敗時も `/api/health` は返す (`db: "down"` で表示)
- 稼働設定・起動方法は `excubitor.catalog.yaml` を確認する。既存 bootstrap の env 読込みを理由に、通常起動へ新たな secret 供給経路を追加しない。
- 個人データ非保管: Cernere user UUID + display_name snapshot のみ持つ

## やらないこと (現フェーズ)

- `web/` は実装済み。画面の現在地は README と対応する feature 仕様を確認する。
- Unity UPM は Step 8 で着手
- WebSocket collaboration は Step 5 で着手
- asset storage (MinIO/S3) は Step 10 で着手

## mvp-plan に従う

`spec/mvp-plan.md` の step は計画の履歴であり、現在の実装状態ではない。
README、対応する feature 仕様、既存 routes を照合して変更する。
複数人向け経路の `requireAuth` / `requireRole` を、個人用モードの説明変更で解除しない。

## migration

`server/migrations/NNN_*.sql` に置く。 Cernere AIFormat の禁止事項を守る:

- `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN ... TYPE` は使わない
- `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` を使う
- skippable error codes (42P07 / 42701 等) は runner が吸収する

`npm run migrate -w server` で順次適用。 `schema_migrations` テーブルで
重複実行を防止。
