# Praeforma レビュー 2026-05-17

| 項目 | 値 |
|------|-----|
| リポジトリ | LUDIARS/Praeforma |
| 対象ブランチ | main |
| レビュー実施日 | 2026-05-17 |
| 対象コミット範囲 | c2639ab～b8518a8 (v0.1 一気通貫実装、6 commits) |

## 総合評価 (16 項目)

| # | 評価軸 | 観点 | 評価 | 重大指摘数 |
|---|-------|------|------|-----------|
| 1 | 設計強度 | 障害分離/冪等性/入力バリ | B | 1 |
| 2 | 設計強度 | エラーハンドリング/リトライ | B | 1 |
| 3 | 設計思想一貫性 | レイヤー/命名/パターン | A | 0 |
| 4 | モジュール分割 | 凝集度/SRP/God Object | A | 0 |
| 5 | データスキーマ | 正規化/型/制約/索引 | A | 0 |
| 6 | SRE | 観測性/ヘルスチェック/デプロイ | B | 2 |
| 7 | 脆弱性 | CWE/入力検証/認証認可 | A | 0 |
| 8 | 脆弱性 | ハードコード秘密/安全性 | A | 0 |
| 9 | テスト | unit/integration/E2E | D | 3 |
| 10 | テスト | エッジケース・境界値 | D | 2 |
| 11 | ライセンス | 依存・互換性・帰属表示 | A | 0 |
| 12 | ドキュメント | README/DESIGN/API | B | 1 |
| 13 | ドキュメント | CHANGELOG/ランブック | B | 1 |
| 14 | 機能改善 | パフォーマンス/UX | B | 2 |
| 15 | 不足機能 | 入力バリデーション/通知 | B | 2 |
| 16 | 統合テスト | 主要フロー | C | 2 |

**weighted_score: B** (デザイン・実装は堅牢、テスト・運用準備が未熟)

## 重大指摘サマリ (計 critical+high: 7 件)

1. **テスト欠如 (D)**: 全スタイル (server/web/Unity) で unit/integration/E2E なし
2. **WS collab 未検証 (C)**: BACKLOG.md で「2 ブラウザで同時編集テスト」TODO、race condition 信頼性不十分
3. **acceptance probe 不完全 (C)**: Step 9 (Unity runtime probe) v0.1 scope 外、server-side eval sandbox なし
4. **reference_content SSRF リスク (B-High)**: Notion/Confluence/GoogleDocs proxy が URL whitelist なし
5. **ドキュメント (B)**: CHANGELOG / development setup guide / troubleshooting なし
6. **トレーシング (B)**: structured logging (traceID/requestID) なし
7. **schema resolver stub (B)**: domain 継承時 required_attrs resolve が stub
