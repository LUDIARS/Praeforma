# Praeforma — Claude 向けメモ

## 性格

仕様書 ↔ 実装連携ツール。 LUDIARS の中では「他が落ち着いたら」 だった枠で、
2026-05-16 に凍結解除 → 実装フェーズに入った。

## 触ってよい / よくない

- 触ってよい: `server/`, `web/`, `Packages/`, `spec/`, root `package.json`, README
- 触らない: 他リポ (Cernere / Memoria 等) — Praeforma は独立
- DB schema 変更: spec/schema/*.md を **正本** として更新 → Drizzle schema +
  migrations を順番に追加 (= 過去 migration は不可逆、 新 NNN ファイルで進める)

## アーキ要点

- Hono + Drizzle + Postgres + tsx (Cernere/Actio と同スタック)
- 起動口 `server/bootstrap.ts`: Infisical 経由で env を確定 → `src/index.ts`
- 認証: Cernere PASETO V4 (`src/auth/paseto.ts`、 公開鍵 6h refresh)
- DB 接続失敗時も `/api/health` は返す (`db: "down"` で表示)
- env 供給: `.env` / `.env.secrets` / Infisical / Excubitor inject の多段
- 個人データ非保管: Cernere user UUID + display_name snapshot のみ持つ

## やらないこと (現フェーズ)

- Unity UPM v0.2 (layout 同期、 Step 8) / Unity runtime probe (Step 9) は未着手
- 実 S3/MinIO adapter は v0.2 (Step 10 は presign stub + assets CRUD まで実装済)

## mvp-plan に従う

`spec/plan/mvp-plan.md` の 14 step を順次。 Step 1〜7 / 10 (scaffold) / 11 /
12 / 13 は完了済 — v0.1 = server REST CRUD + web (配置 editor / 3D preview /
Studio) + WS collab (`/ws/edit`) + acceptance + Unity UPM v0.1。
残りは Step 8 (Unity UPM v0.2 layout 同期) と Step 9 (Unity runtime probe)。
進捗の正本は mvp-plan.md のロードマップ表。 REST handler は
`server/src/routes/` 配下、 `requireAuth` + `requireRole` を組み合わせる。

## migration

`server/migrations/NNN_*.sql` に置く。 Cernere AIFormat の禁止事項を守る:

- `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN ... TYPE` は使わない
- `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` を使う
- skippable error codes (42P07 / 42701 等) は runner が吸収する

`npm run migrate -w server` で順次適用。 `schema_migrations` テーブルで
重複実行を防止。
