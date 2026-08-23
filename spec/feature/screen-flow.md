# Screen Flow — UI 仮置き → 遷移図 + 仕様書 (会話で作る)

プランナーが **画面の UI を placeholder で仮置き** し、 UI 要素に遷移先を付けると
**遷移図 (Mermaid)** と **仕様書 (Markdown)** が生成されるモード。 仕様書の本文は
**LLM トークエリアでの会話** で育て、 ドメインの正確性は **Anatomia のドメイン定義** で
担保し、 確定した仕様は **Concordia (Cc)** へ実装タスクとして接続する。

状態: 実装済 (2026-08-22、 §10 を 1 PR で実装)。 §11 の未決は既定で進めた: Anatomia 未設定時は 503 + 未登録バッジ、 Cc 送出は `PRAEFORMA_CC_TOKEN` の機械 token、 `--model` は `PRAEFORMA_CLAUDE_MODEL`。

## 1. 確定事項 (neco、 2026-08-22)

| # | 決定 | 帰結 |
|---|---|---|
| D1 | 遷移は **UI 要素起点** で持つ | `transitions.source_object_id` が識別の主軸 (PK は別途 `id`、 起点なしを許すため nullable)。 画面→画面の直接遷移は「起点なし」の特例 |
| D2 | 仕様書は **Markdown + Mermaid** | HTML は作らない。 Mermaid は `flowchart` (遷移図) だけを使い、 `stateDiagram` は使わない |
| D3 | ドメインは **Anatomia が必ず正本** (neco 2026-08-22 追記)。 Praeforma は自前のドメイン定義を持たず Anatomia の射影として扱う | Praeforma `domains` は Anatomia `domain-view` の `anatomia_domain` へ結ぶ。 **Thaleia(MUSA) は突合しかしない** (ドメイン配布はしない) (§4) |
| D4 | 仕様書のドメインを **Anatomia を介して連携** | 仕様書の各節に `anatomia_domain` を刻み、 MUSA 経由で code graph と結ぶ (§4.3) |
| D5 | **LLM トークエリア** で仕様書を会話で作る | 既存 Studio の「中央テキストボックス」を会話スレッドに昇格 (§5) |
| D6 | **Cc とも接続** | 確定仕様 → Cc delegation / taskflow へ (§6) |

既存方針との整合: LLM は `claude -p` spawn (`lib/llm.ts`、 API 不使用、 `--model` 固定)、
Anatomia は直叩きせず MUSA 経由 (`lib/musa-relay.ts`)、 設定不備は mock に落とさず明示エラー。

## 2. 再利用 / 新規の切り分け

| 概念 | 実体 | 新規? |
|---|---|---|
| 画面 | 既存 `layouts` (= scene) | 再利用。 既存列 `layouts.kind` に `'screen'` を足して 2D 画面として扱う (現行 default は `'world-3d'`) |
| UI 要素 (ボタン/リスト/入力…) | 既存 `objects` (placeholder) | 再利用。 `domain = UI` 配下に **widget 種別** を `object_attrs` で持つ (§3.1) |
| 画面への配置 | 既存 `layout_objects` | 再利用。 object は layout に直属せず `layout_objects` 経由で複数画面に載る |
| 遷移 | `transitions` | **新規** (migration 004) |
| 仕様書の節 | 既存 `specs` + `spec_targets` | 再利用。 `spec_targets.kind` に `'transition'` 追加 |
| 会話ログ | `spec_conversations` / `spec_messages` | **新規** (migration 004) |
| Anatomia ドメイン参照 | `domains.anatomia_domain` | 既存テーブルへ列追加 |
| Cc 接続記録 | `cc_links` | **新規** (migration 004) |
| 遷移図 / 仕様書 | 生成物 (DB に持たない) | `GET .../export/*` で都度生成 |

## 3. データモデル

以下は設計の要約。 実装時は CLAUDE.md の規約どおり **`spec/data/schema/*.md` を正本として先に更新**
してから migration 004 + Drizzle schema を書く (本節はそこへ写す元ネタであって正本ではない)。
新テーブルは `spec/data/schema/screen-flow.md` を起こし、 `spec/data/schema/README.md` の
テーブル一覧にも行を足す。

### 3.1 UI 要素 (objects の attrs 拡張)

```jsonc
{ "widget": "button|label|list|input|image|tab|modal|custom",
  "label": "スタート",                // 画面上に見える文言
  "action": "navigate|submit|toggle|none" }
```

`object_attrs` は 1 行 = 1 key の縦持ち (`object_id` + `key` + `value` jsonb) なので、
上記は `widget` / `label` / `action` の 3 行になる。 `widget` は既定ドメイン `UI` の
`required_attrs` に追加する (spec F2-3)。 `objects.label` は既存列で別物 (placeholder の
識別名) なので、 画面上の表示文言は attrs 側の `label` を正とする。

### 3.2 transitions

ID は既存規約どおり **`text` (ULID)**。 `uuid` 型は使わない ([schema/README](../data/schema/README.md))。

| 列 | 型 | 意味 |
|---|---|---|
| id | text (ULID) | PK |
| project_id | text | FK `projects.id` |
| from_layout_id | text | FK `layouts.id` — 遷移元画面 |
| source_object_id | text null | **起点 UI 要素** (D1) = FK `layout_objects.id`。 null は画面起因 (タイムアウト/起動時等) |
| to_layout_id | text | FK `layouts.id` — 遷移先画面 |
| trigger | text | `tap` / `submit` / `timeout` / `event:<name>` |
| condition | text null | 「ログイン済なら」等の分岐条件 (自由文、 LLM 会話で整形) |
| label | text null | 遷移図の辺ラベル (空なら trigger + 起点 label から合成) |
| ordinal | int | 同一起点の複数遷移の表示順 (`order` は SQL 予約語。 既存 `layout_objects.ordinal` に合わせる) |
| version | int | 楽観ロック (既存規約) |
| created_at / updated_at | timestamptz | LUDIARS 標準 |

起点は object そのものではなく **`layout_objects` 行** (= 画面上の配置) を指す。 `objects` は
`layout_id` を持たず `layout_objects` で複数画面に載りうるため、 object を直接指すと
「どの画面のそのボタンか」 が決まらない。

制約:

- 同一 `source_object_id` + `trigger` + `condition` は一意。 ただし Postgres の UNIQUE は NULL 同士を
  重複と見なさないため、 `condition IS NULL` の重複は防げない。 **`condition` を NOT NULL
  DEFAULT `''`** とし、 UNIQUE (`source_object_id`, `trigger`, `condition`) を張る (条件なし = 空文字)。
  `trigger` を含めるのは、 同じ UI 要素が `tap` と `long-press` で別の画面へ行く構成を
  許すため (下の画面起因 index と揃える)。
  `source_object_id` が null (画面起因) の行は UNIQUE の対象外になるので、
  `UNIQUE (from_layout_id, trigger, condition) WHERE source_object_id IS NULL` の部分 index を併せて張る。
- `from_layout_id` と `source_object_id` が指す `layout_objects.layout_id` は一致 (サーバ検証)。
- `from_layout_id` / `to_layout_id` / `source_object_id` の `project_id` 一致もサーバ検証
  (他プロジェクトの画面を参照する遷移を作らせない)。

### 3.3 spec_conversations / spec_messages (LLM トークエリア)

| テーブル | 列 |
|---|---|
| spec_conversations | id (text ULID), project_id, target_kind (`project\|domain\|layout\|object\|transition`), target_id, title, created_by, created_at, updated_at |
| spec_messages | id (text ULID), conversation_id, role (`user\|assistant\|system`), content (md), proposals (jsonb NOT NULL DEFAULT `'[]'`), applied_indices (jsonb NOT NULL DEFAULT `'[]'`), created_at |

`target_kind` は CHECK 制約で上記 5 値に限定し、 `(project_id, target_kind, target_id)` に
UNIQUE を張る (下の 「対象 1 つにつき 1 本」 を DB で担保)。 `target_id` は **NOT NULL**
(`target_kind = 'project'` の会話は自分の `project_id` を入れる) — NULL を許すと §3.2 と同じ
「NULL 同士は重複と見なされない」 で UNIQUE が効かなくなる。

`applied_indices` は反映済みの提案 index の配列。 bool 1 つにすると 「index 0 だけ反映 →
残りが永久に反映できない」 (§5.3 の個別反映と両立しない) ため、 index 単位で持つ。

会話は **対象 1 つにつき 1 本** を既定にし、 対象を切り替えると該当会話へ移る。

### 3.4 cc_links

| 列 | 意味 |
|---|---|
| id (text ULID), project_id | FK `projects.id` |
| target_kind / target_id | 何を Cc へ出したか (`spec` / `layout` / `transition`、 CHECK) |
| cc_kind | `delegation_run` / `taskflow_task` (CHECK) |
| cc_id | Cc 側 id |
| status | Cc から取り込んだ最新状態 (`queued\|running\|done\|failed`、 CHECK) |
| last_synced_at, created_at, updated_at | |

UNIQUE (`project_id`, `cc_kind`, `cc_id`) — polling の upsert キー。

## 4. Anatomia ドメイン連携 (D3 / D4)

### 4.1 正本と突合

- **正本は Anatomia** (ドメイン情報は Anatomia に集約される。 neco 2026-08-22)。 Praeforma は Anatomia の
  `GET {PRAEFORMA_ANATOMIA_URL}/api/projects/:id/domain-view` を**読み取り専用**で直接参照し、
  `views[]` (`domain` / `description` / `implementorCount`) をドメイン一覧とする。 Anatomia project id は
  `projects.anatomia_repo` に保存する (migration 004、 `^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)?$` に制限)。
- **Thaleia(MUSA) は突合しかしない**: 仕様 ↔ コードの対応付け (`/relay/anatomia`, §4.3) のみ。
  ドメイン一覧の配布は Thaleia を経由しない (従来の「Anatomia 直叩き禁止」は**解析の二重実装禁止**の意味で、
  正本の読み取り参照はこれに当たらない)。
- Praeforma の `domains` 行は `anatomia_domain: string | null` を持ち、 Anatomia 側ドメインへの**射影**になる。
  名前・説明は Anatomia 側を表示優先し、 Praeforma 側 `name` は UI 用の別名に過ぎない。
- 突合ルール:
  - Praeforma ドメイン作成/改名時、 Anatomia 側に同名 (case-insensitive) があれば自動で `anatomia_domain` を結ぶ。
  - 無い場合は UI で **「Anatomia 未登録」バッジ** を出し、 候補 (description の類似) を提示。 結ばないままでも保存は可 (advisory)。 ただし §6 の Cc 送出時は **必須** (enforced)。
  - Anatomia 側に無いドメインを Praeforma から新設する経路は持たない (ドメイン宣言は実装側 PR で行う。 memory: 新規ディレクトリはドメイン宣言が要る)。
  - `PRAEFORMA_ANATOMIA_URL` 未設定 / `anatomia_repo` 未設定なら突合は行わず全ドメインに未登録バッジを出す (mock 禁止、 503 `anatomia_unconfigured`)。
- API: `GET /api/projects/:pid/anatomia/domains` (Anatomia 一覧 + 各 Praeforma ドメインの突合結果)、
  `POST /api/projects/:pid/anatomia/match` (自動突合を再実行して `anatomia_domain` を埋める)。

### 4.2 仕様書での扱い

仕様書の各節は `anatomia_domain` を frontmatter / 見出し直下に刻む:

```md
## 画面: タイトル  <!-- domain: web-editor (anatomia: web-editor) -->
```

これにより仕様書 → Anatomia ドメイン → membership パス → 実装ファイル、 の経路が機械的に辿れる。

### 4.3 code graph との接続

既存 Studio の `/anatomia-link` を再利用。 target に `transition` を追加し、 MUSA リレーの `query` には 「起点 UI 要素 label + trigger + 遷移先画面名」 を合成して渡す。 返ってきたノードは `code_graph_nodes` に upsert (既存)。

`transition` の追加は以下 3 箇所を揃える必要がある (どれか 1 つでも漏れると 500 になる):

1. `routes/studio.ts` の `targetSchema.target_kind` — 現行は `z.enum(['domain','scene'])`。 API 語彙は `'scene'`、 DB 語彙は `'layout'` で `toGraphKind` が変換している。 `'transition'` は変換なしでそのまま通す。
2. migration 004 で `code_graph_nodes` / `code_graph_edges` / `code_graph_runs` の
   `CHECK (target_kind IN ('domain','layout'))` を `DROP CONSTRAINT IF EXISTS` → 全列挙で張り直す
   (003 で無名 CHECK として作られているため、 `\d` で実名を確認してから外す)。
3. `lib/musa-relay.ts` の `MusaAnatomiaRequest.target.kind` (`'domain' | 'layout'`) に `'transition'` を足す。

### 4.4 MUSA リレー暫定契約の変更

| method | path | 役割 |
|---|---|---|
| POST | `/relay/anatomia` (既存) | 突合のみ。 `target.kind` に `'transition'` を許容 |

ドメイン一覧取得の口は **MUSA に足さない** (Anatomia が正本、 Thaleia は突合のみ)。 未設定時は 503 `musa_relay_unconfigured`。

## 5. LLM トークエリア (D5)

### 5.1 画面構成

```
┌──────────────┬──────────────────────────┬──────────────┐
│ 画面/要素ツリー │ 配置 Canvas (既存)        │ トークエリア  │
│ (layouts →    │ placeholder drag/resize   │ 会話スレッド  │
│  objects)     │ 選択要素に「遷移先」を付与  │ + 提案カード  │
├──────────────┴──────────────────────────┴──────────────┤
│ 下段タブ: 遷移図 (Mermaid) | 仕様書プレビュー (md) | Cc 状態 │
└────────────────────────────────────────────────────────┘
```

トークエリアは **選択中の対象** (画面 / UI 要素 / 遷移 / プロジェクト全体) に紐づく会話を表示する。
対象を変えると会話が切り替わる (§3.3)。

### 5.2 会話の入力文脈

LLM へ渡すプロンプトは毎回サーバで合成する (クライアントから生プロンプトは受けない):

1. 対象の構造: 画面一覧、 当該画面の UI 要素 (widget/label)、 当該要素の遷移
2. 対象ドメインの Anatomia 定義 (`description` + membership)。 未連携なら「未連携」と明記して **推測で埋めない** よう指示
3. 既存 specs (当該対象に紐づく要件)
4. 会話履歴 (直近 N 件、 token 予算内)
5. 出力形式の指示 (§5.3 の proposals JSON + 本文 md)

### 5.3 提案 → 反映

assistant 応答は本文 (md) と `proposals[]` を持つ:

```jsonc
{ "proposals": [
  { "kind": "spec", "target": {"kind":"layout","id":"..."}, "title":"...", "description":"...", "acceptance":["..."] },
  { "kind": "transition", "from_layout_id":"...", "source_object_id":"...", "to_layout_id":"...", "trigger":"tap", "condition":"" },
  { "kind": "object", "layout_id":"...", "widget":"button", "label":"..." }
]}
```

`kind: "object"` の反映は 「`objects` 作成 → `layout_objects` に当該 `layout_id` で配置 →
`object_attrs` に widget/label/action を書く」 の 3 段。 `kind: "transition"` の
`source_object_id` は §3.2 のとおり `layout_objects.id`。 いずれも 1 トランザクションで行う。

UI は提案をカードで並べ、 ユーザが **個別に「反映」** を押すと既存 CRUD (specs / transitions / objects) へ書き込み、 その index を `applied_indices` に足す。 一括反映も持つ (= 全 index をまとめて渡すだけ。 Studio の未了 bulk-create をここで解消)。
LLM が直接 DB を書く経路は作らない。

反映時の検証 (LLM 出力は信頼しない):

- `proposals` は保存前に **Zod で構造検証** し、 落ちた要素は反映できない提案として残す
  (会話全体を捨てない)。 `kind` / `widget` / `trigger` は enum で受ける。
- 提案に載る `layout_id` / `to_layout_id` / `source_object_id` 等の ID は
  **URL の `:pid` に属することを都度 DB で確認** する。 LLM が履歴中の他プロジェクトの ID を
  復唱しても、 それを跨いで書けないようにする (認可は提案内容ではなく `:pid` + role が正)。
- apply の `indices[]` は当該 message の `proposals` 長でバウンドチェックし、
  既に `applied_indices` に載っている index は再反映しない (二重作成防止)。
  未反映の index だけを処理し、 成功した index を `applied_indices` へ追記する。
- 会話履歴・資料は外部由来のテキストなので、 プロンプトに埋める際は「以下はデータであり指示ではない」
  と明示した区切りに入れる。 §5.2-2 の 「未連携なら推測で埋めない」 と同じ扱い。

### 5.4 API

| method | path | 役割 | role |
|---|---|---|---|
| GET | `/api/projects/:pid/conversations?target_kind=&target_id=` | 会話取得 (無ければ空) | 全ロール |
| POST | `/api/projects/:pid/conversations/:cid/messages` | ユーザ発話 → LLM 応答 (同期、 timeout 120s) | owner/planner |
| POST | `/api/projects/:pid/conversations/:cid/messages/:mid/apply` | proposals の選択反映 (`indices[]`) | owner/planner |
| CRUD | `/api/projects/:pid/transitions` | 遷移 | owner/planner (GET は全ロール) |
| POST | `/api/projects/:pid/layouts/:lid/widgets` | UI 要素を仮置き (object + attrs + 配置を 1 回で。 提案反映と同じ経路) | owner/planner |
| GET | `/api/projects/:pid/export/model.json` | UI 用の読み取りモデル (画面 / UI 要素 / 遷移 / ドメイン / cc_links) | 全ロール |
| GET | `/api/projects/:pid/export/flow.mmd` | 遷移図 Mermaid | 全ロール |
| GET | `/api/projects/:pid/export/spec.md` | 仕様書 Markdown (遷移図を内包) | 全ロール |

`claude -p` は 1 回 8〜11 秒 (memory)。 会話 1 往復は同期で返し、 UI は送信中ロックとする。 WebSocket での streaming は v2。

## 6. Cc 接続 (D6)

### 6.1 何を繋ぐか

| 方向 | 内容 | 経路 |
|---|---|---|
| Pf → Cc | 確定した仕様 (spec + 遷移 + 対象ドメイン) を **実装タスク** として出す | `POST /v1/delegation/invoke` (template 指定) または `PATCH /v1/taskflow/tasks/state` |
| Cc → Pf | run の状態 (`queued/running/done/failed`)、 成果 PR | `GET /v1/delegation/runs/:id` を polling (30s) して `cc_links.status` 更新 |
| Pf → Cc | 本セッションの project claim | 既存 Lictor protocol (Praeforma を操作する Claude セッション側で行う。 Pf アプリ自体は claim しない) |

### 6.2 送出ペイロード

delegation の `instruction` は §7 の仕様書 Markdown の **対象節だけ** を切り出して渡す。
先頭に `anatomia_domain` と対象リポを明記し、 委託先が Anatomia supply → verify を回せるようにする。
`anatomia_domain` 未連携の spec は送出を **拒否** (400 `anatomia_domain_required`、 §4.1)。

### 6.3 設定

| 変数 | 役割 |
|---|---|
| `PRAEFORMA_ANATOMIA_URL` | Anatomia web の base URL (ドメイン正本の読み取り) |
| `PRAEFORMA_CC_URL` | Concordia base URL (Excubitor catalog が正本、 ハードコード禁止) |
| `PRAEFORMA_CC_TOKEN` | bearer |
| `PRAEFORMA_CC_TEMPLATE` | 既定 delegation template 名 |

未設定時は「Cc 状態」タブに **未接続** を表示し、 送出ボタンを disabled にする (mock 禁止)。

## 7. 生成物の形式 (D2)

### 7.1 遷移図 `flow.mmd`

```mermaid
flowchart LR
  n1["タイトル画面"]
  n2["ホーム"]
  n3["設定"]
  n1 -->|"[スタート] tap"| n2
  n2 -->|"[設定] tap"| n3
  n2 -->|"timeout 30s"| n1
```

- ノード = 画面 (`layouts`)、 辺 = `transitions`。 辺ラベルは `label` か `[起点label] trigger` + `condition` があれば ` / cond`。
- 画面ごとに `anatomia_domain` があれば `subgraph <domain>` でグルーピングする (任意、 クエリ `?group=domain`)。
- **ノード ID は画面名から作らない。** 画面名は日本語・空白・記号を含む自由文で Mermaid の
  識別子として不正になりうるため、 ID は出現順の `n1` / `n2`… (layout id → 連番の決定的写像) とし、
  表示名は必ず `["..."]` の引用ラベルに入れる。 subgraph id も同様に `g1` / `g2`…。
- **ラベルは全てエスケープする。** 画面名 / 起点 label / condition はユーザ・LLM 由来の自由文で、
  `"` や `|`、 改行、 `-->` を含みうる。 素で埋めると図が壊れる (= 出力の決定性も崩れる)。
  規則: 改行 → 空白、 `"` → `#quot;`、 `|` → `#124;`、 その他の HTML 実体は Mermaid の
  `#NNN;` 形式で置換。 エスケープは `lib/export/flow-mermaid.ts` の 1 関数に集約し、
  §10-7 のテストで 「引用符・パイプ・改行入りの画面名」 をケースに含める。

### 7.2 仕様書 `spec.md`

```
# <project> 画面仕様書
## 1. 画面一覧            (表: 画面名 / ドメイン(anatomia) / UI 要素数 / 遷移数)
## 2. 画面遷移図          (7.1 の Mermaid を埋め込み)
## 3. 画面ごとの仕様
### 3.x <画面名>  <!-- domain: ... -->
  - UI 要素表 (widget / label / action / 遷移先)
  - 要件 (specs: title / description / acceptance)
  - 遷移 (from 要素 → to 画面 / trigger / condition)
## 4. ドメイン共通仕様     (domains に紐づく specs、 Anatomia description を併記)
## 5. Cc 接続状況         (cc_links 一覧、 接続なしなら省略)
```

生成は決定的 (同じ DB 状態なら同じ出力)。 LLM は生成に使わない (会話で中身を作る、 出力は機械整形)。
決定性のために、 全ての一覧は明示 ORDER BY で並べる (画面 = `layouts.name, id`、 UI 要素 =
`layout_objects.ordinal, id`、 遷移 = `transitions.ordinal, id`)。 DB の既定順序に依存しない。
また出力に生成時刻・実行ごとに変わる値を入れない (入れると §10-7 の決定性テストが無意味になる)。

## 8. ワークフロー

```
① 画面を作る (layouts)  →  ② UI 要素を仮置き (objects, widget 付与)
③ 要素を選んで「遷移先」を付ける (transitions)
④ トークエリアで会話 → 提案カードを反映 (specs / transitions / objects)
⑤ ドメインを Anatomia と突合 (バッジが消えるまで)
⑥ 下段タブで遷移図 / 仕様書を確認、 md をダウンロード
⑦ 「Cc へ送る」 → delegation run → 状態が Cc タブに戻る
```

## 9. 非機能 / 制約

- ローカルモード (`local-mode.md`) は現状 **`layout_objects` を非サブセット** としており
  (`db/sqlite-schema.ts` に定義が無い)、 起点 = `layout_objects.id` の本機能はそのままでは動かない。
  ①〜⑥ をローカルでも回すなら §10-1 の DDL 追加に `layout_objects` + 新 4 テーブル
  (+ `domains.anatomia_domain` / `projects.anatomia_repo`) の sqlite 版を含め、 `local-mode.md` の
  制限記述も更新する。 それを行わない間はローカルモードでは ①のみ (画面作成) に留まる。
- ⑦ と §4 は MUSA / Cc 未設定なら明示エラー。
- 楽観ロック・audit・role は既存規約を踏襲。 transitions / conversations も audit 対象。
- SRP: `routes/transitions.ts`, `routes/conversations.ts`, `routes/export.ts`, `lib/export/flow-mermaid.ts`, `lib/export/spec-markdown.ts`, `lib/cc-client.ts`, `lib/conversation-prompt.ts` に分割。 新規ディレクトリは `spec/domains` へ **`screen-flow` ドメイン** を宣言する (membership: `server/src/lib/export/`, `server/src/routes/(transitions|conversations|export).ts`, `web/src/components/flow/`)。 `spec/domains/` には既に `shared-packages` / `spec-authoring` / `web-editor` の 3 件があるので、 同形式 (`name` / `description` / `membership[].pathPattern` の正規表現) で `screen-flow.domain.json` を足す。 追加は §10-2 以降で実コードを足す PR で行う (本 spec 単体の PR では作らない)。

## 10. 実装順 (1 PR 集約、 フルセット)

1. migration 004 (transitions / spec_conversations / spec_messages / cc_links / domains.anatomia_domain / spec_targets.kind / layouts.kind)
   - `spec_targets.kind` は 003 で既に `('object','domain','project','layout')` に広げてある。
     004 でも同様に `DROP CONSTRAINT IF EXISTS spec_targets_kind_check` → `ADD CONSTRAINT` で
     `'transition'` を含む **全列挙** を張り直す (差分追加はできない)。
   - `layouts.kind` は CHECK を持たない自由 text なので `'screen'` の追加に DDL は不要。
   - `domains.anatomia_domain` は `ALTER TABLE ... ADD COLUMN IF NOT EXISTS anatomia_domain text`
     (nullable)。 `(project_id, anatomia_domain)` に UNIQUE は張らない (未連携 = NULL が並ぶため)。
   - `projects.anatomia_repo` も同様に `ADD COLUMN IF NOT EXISTS` (§4.1)。
   - `code_graph_nodes` / `code_graph_edges` / `code_graph_runs` の `target_kind` CHECK を
     `'transition'` 込みで張り直す (§4.3-2)。 003 の無名 CHECK を外すため `DROP CONSTRAINT IF EXISTS`
     を先に置く。 `DROP TABLE` / `DROP COLUMN` / `ALTER COLUMN TYPE` は使わない (AIFormat)。
   - Postgres の migration と併せて **`server/src/db/sqlite-schema.ts` の `SQLITE_DDL` / `sqliteTables`
     も揃える** (ローカルモード。 §9 の判断次第で `layout_objects` も含む)。 片方だけ足すと
     ローカルモードで 「テーブルが無い」 の実行時エラーになる。
2. REST: transitions CRUD + export (flow.mmd / spec.md)
3. REST: conversations + prompt 合成 + proposals apply
4. MUSA 契約追加 (domains 取得) + 突合ロジック + anatomia-link の transition 対応
5. Cc client + cc_links + polling
6. Web: 3 ペイン + 下段タブ (Mermaid 描画 / md プレビュー / Cc 状態) + 遷移先付与 UI
7. テスト (最低限、 全て自動テストで回す)。
   **前提: 現状この repo にはテストランナーが無い** (`package.json` に `test` script 無し、
   CI は `harness.yml` の AIFormat チェックのみ)。 本ステップの最初に `node --test` +
   `npm test` script + CI ジョブを足すところから始める。 これが無いと以下は「書いたが回らない」になる。
   - export の決定性 — 同一 DB 状態で 2 回生成して同一、 かつ挿入順を変えても同一 (§7.2 の ORDER BY)
   - Mermaid エスケープ — `"` / `|` / 改行 / `-->` を含む画面名・condition で図が壊れない (§7.1)
   - 突合ルール — 同名 case-insensitive で結ぶ / 無ければ未登録のまま保存できる / `anatomia_repo` 未設定時
   - proposals apply — Zod 落ちの提案は反映されない、 他プロジェクトの ID を含む提案は 404/400、
     `indices[]` の範囲外、 二重 apply が弾かれる (§5.3)
   - transitions 制約 — `from_layout_id` と起点の `layout_objects.layout_id` 不一致は 400、
     `condition` 空文字での重複が UNIQUE で弾かれる (§3.2)
   - Cc / MUSA 未設定時の明示エラー (503 `musa_relay_unconfigured` / Cc 未接続)、 mock に落ちないこと
   - `anatomia_domain` 未連携の spec の Cc 送出が 400 `anatomia_domain_required` (§6.2)

## 11. 未決 (neco 確認待ち)

- MUSA(Thaleia) 本体が未実装のため、 §4.4 の `domains` 取得は **Thaleia 側のタスク** になる。 先に Praeforma だけ進めるなら §4 はバッジ表示まで (突合はリレー到着後) とするか。
- Cc の template 名 (既定) と、 Pf からの送出を **誰の権限** で行うか (Pf サーバの機械 token か、 操作ユーザの Cernere 身元か)。
- 会話の LLM モデル固定値 (`--model`)。 Studio 既存値に合わせる想定。
