# 受入状態の要約 API

プロジェクトの受入 (acceptance) 状態を 1 回の GET で読む、読み取り専用の JSON API。
Breviarium などローカル (loopback) の外部ツールが「検査 praeforma/acceptance」の証跡として使う。
run の記録そのもの ([data/schema/acceptance.md](../data/schema/acceptance.md)) は変えない。

## PF-ACC-SUM-1 経路と権限

`GET /api/projects/:pid/acceptance/summary`

- 他のプロジェクト読み取り API と同じく `requireAuth` + `requireRole` (viewer 以上) を通す。
- ローカルモード ([local-mode.md](./local-mode.md)) では認証を持たない固定ローカルユーザが入り、
  Origin 判定 (`server/src/lib/local-access.ts`) を通った要求は認証なしで読める。
- 通常モードでトークンが無い要求は 401、メンバーでないプロジェクトは 403。
- `/runs` 系と違い、要約はローカルモードでも載せる (受入テーブルがないため run 0 件として返す)。

## PF-ACC-SUM-2 応答

```json
{
  "projectId": "…",
  "runs": { "total": 3, "byStatus": { "passed": 2, "failed": 1 } },
  "latestRun": { "id": "…", "status": "failed", "startedAt": "ISO", "finishedAt": "ISO|null", "version": null },
  "results": { "total": 5, "passed": 3, "failed": 1, "blocked": 1, "pending": 0 },
  "specVersion": "0.3.12"
}
```

- `runs.byStatus` は出現した run status ごとの件数 (0 件の status は載せない)。
- `latestRun` は `startedAt` が最も新しい run (同時刻は id (ULID) の大きい方)。run 0 件なら `null`。
- `latestRun.version` は run 時点の仕様版。現スキーマは run に版を記録しないため常に `null`。
- `results` は最新 run の `acceptance_results` の集計。`pass`→passed、`fail`→failed、
  `error`→blocked (評価できなかった)、`skip` とそれ以外→pending。run 0 件なら全て 0。
- `specVersion` はプロジェクトの仕様版 ([schema/spec-versioning.md](../schema/spec-versioning.md))
  の `major.minor.patch`。版がまだ無ければ `"0.0.0"`。
- 個人情報 (`triggered_by`) と自由記述 (`observed` / `error_message` / `log_excerpt` / `summary`) は返さない。

## 実装の置き場所

- 集計は純関数 `server/src/lib/acceptance-summary.ts` (DB 行を受け取り応答を返す)。
- 読み取りは `server/src/db/acceptance-summary-reads.ts`、経路は `server/src/routes/acceptance.ts`
  の `makeAcceptanceSummaryRouter` (I/O のみ)。
