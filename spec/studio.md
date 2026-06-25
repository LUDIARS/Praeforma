# Studio — 要件定義モード

プランナーが「ドメイン / シーンを宣言 → LLM 補助で要件定義を具体化 → 回帰テストを設計
→ Anatomia で関連処理グラフを更新 → 調整」 を、 中央テキストボックス + 進捗ステップの
シンプル UI で回すモード。 既存 Praeforma スタック (Hono + Postgres + React) に 1 機能
として載せる。

## 位置づけ (MUSA 連携、 2026-06-25 確定)

- **Pf × Anatomia = Thaleia** (企画↔実装トレーサビリティ)。 ドキュメント文脈の主体は
  Praeforma 側。 リレー契約は Praeforma 主導で**暫定**定義し、 MUSA 本体実装時に批准する。
- Praeforma は Anatomia CLI を**直叩きしない**。 必ず MUSA を経由する (= `lib/musa-relay.ts`)。
- LLM は **claude CLI (`claude -p`)** を spawn (LUDIARS 規約: API 不使用)。 `lib/llm.ts`。
- 設定不備 (MUSA URL 未設定 / claude 不在) は **mock に落とさず明示エラー** (無言 fallback 禁止)。

## 再利用 / 新規の切り分け

| 概念 | 実体 | 新規? |
|---|---|---|
| ドメイン | 既存 `domains` | 再利用 |
| シーン | 既存 `layouts` (spec §4 で layout = scene) | 再利用 |
| 要件定義 | 既存 `specs` | 再利用 |
| 回帰テストケース | 既存 `spec_acceptance` | 再利用 |
| spec が scene を指す | `spec_targets.kind` に `'layout'` 追加 | 拡張 (migration 003) |
| 関連処理グラフ | `code_graph_nodes` / `_edges` / `_runs` | 新規 ([schema/code-graph.md](./schema/code-graph.md)) |

## UX フロー

```
① (任意) 資料取込 ─ 仕様書/画面遷移リスト/Anatomia解析結果 → ドラフトの domain/scene/要件
② メニュー ─ 「ドメイン新規」「ドメイン調整」「シーン新規」「シーン調整」の 4 択
③ 要件定義 ─ 対象に対し LLM が要件+回帰テストを提案 → 選択して確定 (= specs 作成)
④ Anatomia ─ MUSA(Thaleia) 経由で関連処理を検索 → code graph を upsert
⑤ グラフ調整 ─ ノードの除外/復帰/削除・手動追加
→ ② に戻る
```

中央テキストボックスは各ステップで文脈に応じた入力 (資料 / 名前 / LLM への補足 / 検索クエリ) に
使い回す。 進捗は 5 ステップの stepper で表示。

## API (`/api/projects/:pid/studio`)

| method | path | 役割 | role |
|---|---|---|---|
| POST | `/ingest` | 資料 → ドラフト提案 (永続化しない) | owner/planner |
| POST | `/suggest` | 対象の要件+回帰テストを LLM 提案 | owner/planner |
| POST | `/anatomia-link` | MUSA リレー → グラフ upsert + run 記録 | owner/planner |
| GET | `/graph?target_kind=&target_id=` | グラフ + 直近 run 取得 | 全ロール |
| POST | `/graph/nodes` | 手動ノード追加 | owner/planner |
| PATCH | `/graph/nodes/:nid` | status/label 変更 (除外/復帰/改名) | owner/planner |
| DELETE | `/graph/nodes/:nid` | ノード削除 (端の edge も削除) | owner/planner |
| POST | `/graph/edges` | 手動 edge 追加 | owner/planner |
| DELETE | `/graph/edges/:eid` | edge 削除 | owner/planner |

`target_kind` は UX 上 `domain` / `scene`。 サーバ内部で `scene → layout` に対応付ける。

## MUSA リレー暫定契約

`POST {PRAEFORMA_MUSA_URL}/relay/anatomia` (bearer = `PRAEFORMA_MUSA_TOKEN` 任意):

```jsonc
// request
{
  "project": "<project name>",
  "target": { "kind": "domain|layout", "id": "...", "name": "...", "description": "..." },
  "requirements": [{ "code","title","description","priority","category","acceptance": ["..."] }],
  "query": "<検索文>",
  "repo": "<任意: 解析対象リポ>"
}
// response
{
  "nodes": [{ "key": "...", "label": "...", "type": "symbol", "anatomia_ref": { "path": "..." } }],
  "edges": [{ "from": "<node key>", "to": "<node key>", "relation": "calls" }],
  "summary": "<任意>"
}
```

## 環境変数

| 変数 | 既定 | 役割 |
|---|---|---|
| `PRAEFORMA_CLAUDE_BIN` | `claude` | 要件サジェスト用 claude CLI (Windows は git-bash 経由 wrapper を差せる) |
| `PRAEFORMA_MUSA_URL` | (なし) | MUSA(Thaleia) リレー base URL。 未設定なら `/anatomia-link` は 503 `musa_relay_unconfigured` |
| `PRAEFORMA_MUSA_TOKEN` | (なし) | MUSA リレーの bearer token |

## 未了 / 次フェーズ

- MUSA(Thaleia) 本体は未実装。 上記契約は暫定で、 MUSA 着手時に批准・調整する。
- グラフの可視化は現状リスト表示。 将来 three.js/2D グラフ描画に拡張余地。
- ingest の提案を一括反映する bulk-create は未実装 (現状は 1 件ずつ作成)。
