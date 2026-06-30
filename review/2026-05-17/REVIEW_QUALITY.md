# 品質保証レビュー — Praeforma v0.1 (2026-05-17)

## 1. テスト戦略・カバレッジ: D

| 評価 | 観点 | 所見 |
|------|------|------|
| D | unit テスト | テストファイル (*.test.ts) ゼロ。acceptance.ts (277 loc)、collab.ts (200+ loc)、audit.ts (43 loc) の core logic 未テスト |
| D | integration テスト | DB → route → response フローが手探り、自動化なし。RUN_ROLES validation / CAS 失敗 / bulk update edge case 未検証 |
| D | E2E テスト | Web からプロジェクト作成 → オブジェクト配置 → spec 編集 → 保存フローが未検証、WS collab (2 ブラウザ同時編集) も手動 |
| D | エッジケース | limit=0、offset=999999、domain.max_count violation、spec.version CAS failure、WS auth timeout 未テスト |
| D | CI テスト自動実行 | npm run typecheck (型のみ)、unit/integration/E2E CI 統合なし |

### 具体的テストギャップ

1. spec bulk acceptance PATCH: 空配列で呼ぶと DB state inconsistency?
2. layout_objects bulk replace: transaction fail 時 rollback?
3. object 親子関係: 存在しない parent_object_id で fail message が user-friendly か?
4. WS op broadcast: 接続直後 auth check より先に op 処理されるか? (collab.ts:107-180 で auth 必須化 OK だが verify 必要)
5. Cernere PASETO expired: 6h 後 token refresh がサーバに反映?

## 2. ライセンス遵守: B

| 依存 | ライセンス | 配布 | 互換性 |
|------|----------|------|--------|
| hono | MIT | server | OK |
| drizzle-orm | Apache 2.0 | server | OK |
| react / react-dom | MIT | web | OK |
| three.js | MIT | web | OK |
| @tanstack/react-query | MIT | web | OK |
| typescript/vite | MIT | dev | OK |
| paseto | MIT | server | OK |
| ws | MIT | server | OK |

- [x] LICENSE ファイル: なし (推奨: LUDIARS 所有権明記)
- [x] 互換性: MIT/Apache、GPL なし
- [x] バンドル配布帰属表示: THIRD_PARTY_LICENSES なし
- [x] AI 生成コード方針: 未明示

**推奨**: README に `## License` セクション + `LICENSE`/`THIRD_PARTY_LICENSES.md` を repo root に。

## 3. ドキュメント完備性: B

| 評価 | 観点 | 所見 |
|------|------|------|
| A | README 網羅 | 29 行、概要・ステータス・関連プロジェクト、最短起動手順 (env/npm install/dev) なし |
| A | DESIGN / アーキ図 | spec/praeforma.md (651 行)、mvp-plan.md 14-step roadmap、system diagram なし |
| B | API リファレンス | spec/api/README.md 一覧表、request/response body は markdown table のみ (Postman import 困難) |
| B | inline コメント | route handler に function comment、complex logic (acceptance pattern / collab race) 説明不足 |
| C | CONTRIBUTING / ランブック | 未作成、migration 失敗時 / Cernere key refresh timeout 時 runbook 必要 |

### ドキュメント リスト

```
Completed:
- README.md / CLAUDE.md / BACKLOG.md
- spec/praeforma.md / spec/mvp-plan.md / spec/api/README.md
- spec/schema/ (11 files) / spec/unity-editor.md / spec/acceptance-script.md
- spec/competitive.md / spec/cli.md

Missing:
- CONTRIBUTING.md / TROUBLESHOOTING.md / ARCHITECTURE.md
- THIRD_PARTY_LICENSES.md / CHANGELOG.md
- openapi.yaml or postman collection
```

## 総合評価

| # | 観点 | 評価 |
|---|------|------|
| 1 | テスト戦略 | D (5: 全層欠如) |
| 2 | ライセンス | B (2: LICENSE/THIRD_PARTY 未作成) |
| 3 | ドキュメント | B (2: CONTRIBUTING/ランブック 未作成) |

**評価: C** (デザイン・実装は A だが、テスト・ドキュメント・ライセンス準備が v0.1 scope 外)
