# Praeforma — 仕様書 ↔ 実装連携ツール

> 命名: **Praeforma** (Latin: 「前形 / 雛形 / template」)。 略称: `Pf`。
> placeholder = 「後で実体が入る型枠」 を作り、 designer / programmer が
> そこに具体物を当てていく — 本ツールの本質をそのまま表す名前。

---

## 1. 目的・存在意義

「**プランナーが考えた配置と仕様を、 placeholder のまま動く形にして、 後から
デザイナーが art を当てる**」 ワークフローを成立させる汎用ツール。

- 紙の企画書 / 文章だけだと 「実装したらこんな感じ」 が掴めない
- Unity に直接組むと プランナーが触れない / デザイナーの art を待たないと
  動かせない
- 仕様変更時に 「仕様書」 「実装」 「アセット」 の 3 つが乖離する

これを **placeholder ベースのレイアウト** + **構造化された仕様テキスト** +
**後差し替え可能なアセット** の 3 つで吸収する。

### ターゲットユーザ
- **プランナー**: オブジェクト配置 + ドメイン定義 + 仕様文章
- **デザイナー**: placeholder を絵 / 3D モデルに差し替えてレイアウト調整
- **プログラマー**: 仕様 + ドメイン定義を実装に落とし込む

### Ars との関係
- Ars はゲーム開発のアセット/参考集積。 本ツールはアセットを使う側
- 統合候補だったが 「ゲームに限らず汎用 (= 業務システム / 教育コンテンツ /
  シミュレータ等にも使える)」 ため分離

---

## 2. 用語

| 用語 | 定義 |
|---|---|
| **オブジェクト** (Object) | 配置可能な実体。 `Player` / `Enemy` / `HP Bar` / `Wall` 等。 placeholder (cube / 四角 / 仮画像) で表示 |
| **ドメイン** (Domain) | オブジェクトの分類軸 / 役割定義。 `Player` `Enemy` `Terrain` `UI` 等。 オブジェクトは 1 つ以上のドメインに属する |
| **レイアウト** (Layout) | オブジェクトの空間配置 (座標 + サイズ + 回転 + 親子関係)。 3D ならカメラアングルも含む |
| **仕様** (Spec) | テキストで書かれた要件定義。 オブジェクト または ドメインに紐付く |
| **アセット** (Asset) | デザイナーが差し替える画像 / 3D モデル。 placeholder を置換 |
| **プロジェクト** (Project) | 1 つの作品単位。 上記すべてを束ねる最上位 |
| **プラットフォーム** (Platform) | 出力先。 `unity` / `webgl` / `2d-web` 等 |

---

## 3. 機能要件

### F1. オブジェクト配置 (プランナー、 placeholder ベース)

- プランナーが画面上で placeholder (四角 / キューブ / 仮画像) を配置する
- **配置パラメータ**
  - 座標 (2D: x/y、 3D: x/y/z)
  - サイズ (幅 / 高さ、 3D は奥行きも)
  - 回転 (2D: 角度、 3D: euler / quaternion)
  - 親子関係 (`HP Bar` は `Player` の子、 等)
  - ラベル (画面上に表示する仮名 = "Player", "Enemy A" 等)
- **placeholder の見た目**
  - 既定: 単色 cube / 四角 (ドメイン別色分け)
  - 任意: アップロードした仮画像 (PNG / JPG / Sprite)
  - アスペクト比 / 透過対応
- **3D の場合 (WebGL)**
  - カメラアングル設定 (位置 / 注視点 / FOV / 近遠面)
  - 複数カメラを切替可能 (default / debug / cinematic 等)
  - ジオメトリ primitive (cube / sphere / plane / cylinder) を選択

#### 操作仕様
- ドラッグで移動 / 端ハンドルでリサイズ / 回転ハンドル
- スナップ (グリッド / 他オブジェクト端) — 任意 toggle
- 複製 (Ctrl+D)、 削除 (Del)
- undo / redo (Ctrl+Z / Ctrl+Shift+Z) は最低限必要

---

### F2. ドメイン定義

#### F2-1. ドメインとは
オブジェクトの **役割 / 領域 / カテゴリ** を表す概念。 例:
- `Player`: 操作対象キャラクタ
- `Enemy`: 敵キャラクタ
- `Terrain`: 移動可能 / 不可能な地面 / 壁
- `UI`: 画面上に固定表示される HUD / メニュー
- `Trigger`: 接触イベント発火域
- `Camera`: 描画視点
- `Light`: 光源 (3D 用)
- `Spawner`: オブジェクトを動的生成する点

ユーザがプロジェクト毎に定義可能。 既定セットは提供する。

#### F2-2. ドメインの仕様
ドメインそれ自体に対しても仕様 (= 共通振る舞い) を書ける。 例:
- 「Player ドメインのオブジェクトは速度 5 m/s で WASD 移動」
- 「Enemy ドメインのオブジェクトは Player を視認したら追跡」
- 「UI ドメインは常にカメラに対して 2D 平面で描画される」

#### F2-3. ドメインのメタ
| 項目 | 用途 |
|---|---|
| name | 表示名 (`Player`) |
| color | placeholder のデフォルト色 |
| icon | 一覧 UI でのアイコン |
| max_count | 最大配置数 (例: Player は 1 〜 4 のみ等) |
| required_attrs | このドメインに属するオブジェクトが持つべき attribute (例: Player は必ず `hp`, `speed` を持つ) |
| inherits | 親ドメイン (継承) |

---

### F3. テキストによる仕様記述 (要件定義形式)

オブジェクト または ドメインに対して、 テキストで仕様を書く。

#### F3-1. 構造化される必要がある (= 自由作文ではなく、 要件定義の形式を満たす)

```yaml
spec:
  id: SPEC-001-PLAYER-MOVE
  target:
    kind: domain   # or "object"
    ref:  Player
  priority: must   # must / should / could / wont (MoSCoW)
  category: behavior  # behavior / appearance / data / interaction
  title: WASD で 8 方向移動
  description: |
    Player ドメインのオブジェクトは W/A/S/D キーで 上 / 左 / 下 / 右
    に移動する。 斜め入力時は 8 方向、 速度は単一方向と同じ (= 斜め補正なし)。
  preconditions:
    - Player ドメインに属するオブジェクトが 1 つ以上存在する
    - 入力デバイスがキーボードを含む
  postconditions:
    - 入力 1 フレーム以内に位置が変化する
  acceptance:
    - キー入力なしのフレームでは位置が変わらないこと
    - 速度は ドメイン定義の `speed` 属性に従う
  related:
    - SPEC-002-PLAYER-COLLISION
```

- フォーマット: YAML フロントマター + Markdown 本文。 もしくは JSON / TOML 互換
- 1 spec = 1 ファイル (推奨) もしくは 1 ファイルに複数 spec を block で
- `id` はプロジェクト内 unique。 `SPEC-NNN-<DOMAIN>-<VERB>` 規約
- `priority` は MoSCoW (must / should / could / wont) を既定とする
- `acceptance` は automated test の基礎にもなる
- フリーフォームの「description」 と構造化された「pre/post/acceptance」 を併存

#### F3-2. spec の編集体験
- エディタは split view (左: 仕様ツリー、 右: 該当オブジェクトの placeholder ハイライト)
- spec から target object へ jump、 object から関連 spec をフィルタ
- バリデーション (id 衝突、 target 参照切れ、 必須項目欠落) は保存時にリアルタイム

#### F3-3. 既存要件定義フォーマット互換
- IEEE 830 ベースの SRS 風項目を yaml で表現
- 将来的に Gherkin (Given/When/Then) や OpenAPI-like への変換出力も視野

---

### F4. アセット差し替え (デザイナー)

- デザイナーが画像 / 3D モデルを placeholder に対して差し替えできる
- レイアウト微調整 (位置 / サイズ / 回転) も同じ画面で
- placeholder ↔ asset は 「**view-only 差し替え**」 (= placeholder メタは
  プランナーの所有、 デザイナーは見た目だけ変える) と 「**override
  差し替え**」 (= 位置 / サイズも調整できる) の 2 モード
  - 既定は override。 必要に応じてプランナーが lock 可能
- アセット種別
  - 2D: PNG / JPG / SVG / WebP / Sprite atlas
  - 3D: glTF / GLB (推奨)、 FBX (Unity 経由)、 Unity Prefab
  - パーティクル: 各 platform native (Unity ParticleSystem 等)
- 1 オブジェクトに対して platform 別に複数アセットを持てる
  - 例: 同じ `Player` オブジェクトに対して `unity` 用に Prefab、
    `webgl` 用に glTF、 `2d-web` 用に Sprite シート

#### F4-1. Unity 上で直接レイアウト可能
Unity プロジェクトを Praeforma エクスポートとして開き、 Unity の Scene
ビューで Prefab 差し替え / 位置調整しても、 結果が Praeforma 側のレイアウトに
反映 (双方向同期) されること。

詳細は [§5 プラットフォーム別実装 - Unity](#unity) を参照。

---

## 4. データモデル (DB ベース)

永続化は **Postgres** (LUDIARS 標準スタックに準拠)。 schema 定義は
[`spec/schema/`](./schema/) に 1 ドメイン 1 ファイルで配置。 マイグレーションは
`migrations/NNN_description.sql` の番号付き SQL で管理する (Cernere / Memoria
Hub と同じ pattern)。

### 主要テーブル (概観)

| ドメイン | spec | 主テーブル |
|---|---|---|
| プロジェクト | [schema/project.md](./schema/project.md) | `projects` / `project_members` |
| ドメイン (= Domain 定義) | [schema/domain.md](./schema/domain.md) | `domains` |
| オブジェクト | [schema/object.md](./schema/object.md) | `objects` / `object_attrs` |
| 配置 (= scene / layout) | [schema/layout.md](./schema/layout.md) | `layouts` / `layout_objects` / `cameras` |
| 仕様 | [schema/spec.md](./schema/spec.md) | `specs` / `spec_acceptance` / `spec_targets` |
| アセット | [schema/asset.md](./schema/asset.md) | `assets` / `object_assets` |
| acceptance run | [schema/acceptance.md](./schema/acceptance.md) | `acceptance_runs` / `acceptance_results` |
| collaboration | [schema/collab.md](./schema/collab.md) | `edit_sessions` / `edit_ops` / `audit_log` |

詳細は各 schema ファイル参照。 ファイル群は本仕様書を元に別途生成する。

### TS / ORM
- **Drizzle ORM** を採用 (Cernere / Actio 互換)
- 各テーブル定義は `server/src/db/schema/<domain>.ts` に分割
- `server/src/db/repository.ts` で façade 層を切る (route から ORM 直叩き禁止)

### JSON エクスポート / インポート

DB を正本としつつ、 git 親和性 (差分レビュー / branch protection) のため
**プロジェクト snapshot を YAML/JSON にエクスポート / インポート可能**にする。
ローカル開発・例示・テスト fixture でも使う。

```
project-export/
├── praeforma.yaml         # プロジェクト meta (name / platforms / version)
├── domains/
│   ├── player.yaml         # ドメイン定義 (1 row → 1 ファイル)
│   └── enemy.yaml
├── objects/
│   └── player-1.yaml
├── specs/
│   └── SPEC-001-player-move.md   # YAML frontmatter + Markdown 本文
├── layouts/
│   └── default.yaml
└── assets/                # バイナリ参照 (実体は object storage)
    └── manifest.yaml
```

### object 行の例 (JSON)
```json
{
  "id": "obj_01HXY...",
  "project_id": "proj_01HXY...",
  "domain_id": "dom_player",
  "label": "プレイヤー (主人公)",
  "placeholder": {
    "shape": "cube",
    "color": "#3366ff",
    "image_asset_id": null
  },
  "transform": {
    "position": [0, 0, 0],
    "rotation": [0, 0, 0],
    "scale": [1, 1.8, 1]
  },
  "parent_id": null,
  "attrs": { "hp": 100, "speed": 5.0 },
  "assets_by_platform": {
    "unity": "asset_01HXY... (prefab)",
    "webgl": "asset_01HXY... (glb)"
  }
}
```

### layout 行の例 (JSON)
```json
{
  "id": "layout_default",
  "name": "メインシーン",
  "camera": {
    "kind": "perspective",
    "position": [0, 5, -10],
    "target": [0, 0, 0],
  fov: 60
objects:
  - ref: player-1
    transform: { position: [0, 0, 0] }
  - ref: enemy-a
    transform: { position: [5, 0, 0] }
  - ref: hp-bar
    transform: { position: [10, 950, 0] }  # UI 座標 (画面 px)
    parent: ui-root
```

---

## 5. プラットフォーム別実装 (Web + Unity の 2 系統)

MVP では **Web** (= editor + 3D/2D preview 兼用) と **Unity** (= editor 拡張
+ runtime) の 2 つを並行実装する。 両者は同じ Praeforma バックエンド (Postgres)
に対して REST + WebSocket で読み書きする。

### 5.1 Web 系 — Editor + Preview

#### 役割
- プランナーのメイン作業場
- placeholder の 2D / 3D 配置 + spec 編集 + アセット差し替え + コラボ
- 3D は WebGL (three.js)、 2D は Canvas/SVG。 同じ editor 内のタブで切替

#### 構成
- フロント: React + TypeScript + Vite (Actio と同系統スタック)
- バック: Hono + TypeScript (Node.js) + Drizzle + Postgres
- リアルタイム同期: WebSocket (Cernere セッション経由、 詳細 §13)
- 3D: three.js (rapier or cannon-es は物理が要る場合)
- 2D: Canvas 2D or SVG (= UI モック等)
- ファイル UI: アセット upload は object storage (MinIO / S3)

#### 機能
- placeholder 配置 (§F1) — drag / resize / rotate / snap / undo
- ドメイン定義 UI (§F2) — ツリー表示 + 継承
- spec エディタ (§F3) — split view (左 spec ツリー / 右該当 object ハイライト)
- asset 差し替え (§F4) — drag-drop upload + diff preview
- preview tab — runtime ループを start/stop してアクセプタンスマーカ表示

### 5.2 Unity 系 — Editor 拡張 + Runtime {#unity}

#### 役割
- デザイナー / プログラマーの作業場
- Praeforma の placeholder を Unity Scene に展開、 Prefab を当てて
  そのまま実装に進める

#### 構成
- パッケージ: `Packages/jp.ludiars.praeforma/` (UPM) — C# Editor 拡張
- runtime: 同パッケージに `PraeformaRuntime` 名前空間で含める
- 通信: Unity 内 HTTP client で Praeforma バックエンドに REST + WS

#### Editor 拡張
- Window: `Window > Praeforma > Project Explorer` — DB 上のプロジェクト一覧
  → 選択して open
- Scene 生成: 選択した Layout を Scene に展開 (placeholder Prefab を配置)
- Inspector: placeholder 選択中に紐付く spec を一覧表示 + 編集
- Prefab Assign: placeholder の slot に Prefab を D&D → `object_assets`
  テーブル の unity 行に backref
- 双方向同期: Scene の Transform 編集を保存すると DB の `layout_objects` に反映

#### Runtime
- ビルドゲームに同梱して 「placeholder のままでも遊べる」 状態を作る
- spec の `acceptance` を runtime probe で検査して結果を DB に書き戻す
  (= QA レーンの自動化)

### 5.3 (将来) その他 platform

- Godot / native mobile / 2D Web (ピクセル / カードゲーム) — 同じ
  バックエンドに対する viewer / editor を plugin として追加。 MVP では
  Web の 2D Canvas でカバーする。

---

## 6. ワークフロー

```
[企画フェーズ]
プランナー
  ↓ オブジェクト配置 (placeholder)
  ↓ ドメイン定義
  ↓ spec 記述 (F3 形式)
[review]
  ↓ プログラマー + デザイナー + プランナーで spec 妥当性確認
[制作フェーズ]
プログラマー                  デザイナー
  ↓ ドメイン挙動を実装          ↓ Unity / Web で asset 差し替え
  ↓ spec.acceptance をテスト化  ↓ レイアウト微調整
[統合]
  ↓ asset + 実装 + spec が揃ったオブジェクトから順に「完成」 マーク
  ↓ 全部 ✓ になれば release 候補
```

---

## 7. 非機能要件

- **国際化**: spec の本文は markdown 自由記述、 UI は i18n
- **アクセシビリティ**: placeholder 配置は keyboard only でも操作可能
- **パフォーマンス**: 数百 object / 数百 spec を含むプロジェクトを 1 秒以内に open できる
- **データ正本は DB**、 git に置くのは spec/schema/ と migrations と export snapshot のみ

---

## 8. 決定事項 (2026-05-16)

| 項目 | 決定 |
|---|---|
| 永続化 | **Postgres + Drizzle ORM**。 schema は [spec/schema/](./schema/) に 1 ドメイン 1 ファイル。 マイグレーションは番号付き SQL |
| MVP スコープ | **Web + Unity の 2 系統並行** (§5)。 2D Web は Web の 1 tab として吸収 |
| acceptance test 自動化 | **v1 から「runtime probe → 結果記録」 を組み込む** (詳細 §11) |
| collaboration | **Cernere 連携前提**で組む (詳細 §12) |
| 略称 | `Pf` を LUDIARS PROJECT-CODES に追記 (別 PR) |

### 残課題
- [ ] spec id 規約: `SPEC-NNN-<DOMAIN>-<VERB>` でいいか、 桁数は?
- [ ] 既存ツール (Notion + Figma + Unity) との差分明示
- [ ] CLI 整備 (`praeforma export ... ` 系)
- [ ] エクスポート snapshot のディレクトリ規約

---

## 9. リポジトリ構成 (案)

```
Praeforma/
├── README.md
├── spec/
│   ├── praeforma.md         # 本ファイル (= 設計書 / 仕様の仕様)
│   ├── schema/              # DB スキーマ (1 ドメイン 1 ファイル)
│   │   ├── README.md
│   │   ├── project.md
│   │   ├── domain.md
│   │   ├── object.md
│   │   ├── layout.md
│   │   ├── spec.md
│   │   ├── asset.md
│   │   ├── acceptance.md
│   │   └── collab.md
│   └── api/                 # HTTP / WS 契約
│       └── README.md
├── migrations/              # 番号付き .sql マイグレーション
│   └── 001_init.sql
├── server/                  # Hono + Drizzle + Postgres バックエンド
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema/      # Drizzle テーブル定義 (spec/schema/ と 1:1)
│   │   │   ├── repository.ts
│   │   │   └── connection.ts
│   │   ├── routes/          # REST API
│   │   ├── ws/              # WebSocket (collaboration)
│   │   ├── acceptance/      # acceptance runner
│   │   └── index.ts
│   └── package.json
├── frontend/                # Web Editor (React + Vite)
│   ├── src/
│   │   ├── editor/          # 配置エディタ (3D = three.js / 2D = Canvas)
│   │   ├── spec-editor/     # spec エディタ
│   │   ├── preview/         # 動作プレビュー (acceptance ランナー)
│   │   └── api/             # backend client
│   └── package.json
├── unity-package/           # UPM パッケージ jp.ludiars.praeforma
│   ├── Editor/              # C# Editor 拡張
│   ├── Runtime/             # PraeformaRuntime (動作試作 + probe)
│   └── package.json
├── examples/
│   └── kuzu-survivors/      # サンプルプロジェクト (export snapshot)
└── docs/
    └── spec-format.md       # F3 で定義した仕様テキスト形式の詳細
```

---

## 10. 命名について

**Praeforma** (Latin「前形 / 雛形 / template」) を採用。

- placeholder = 「後で実体が入る型枠」 を作る → designer が art を当てる
- spec で要件の型を outline する → programmer がそこに実装を流し込む

の両方の意味で適合する。 略称は `Pf`。 既存 LUDIARS コード (At / L / In /
Af / Ao / Cr / Iv / Nt / AC / Mm / Pc / Eg / Cs / Ar / Ap / As / Ca / Di /
Sy / Te / Cx / Cu / Cl / Si / It / Am / Au / Ax) と衝突しない。

検討した別案:
- Adumbratio (`Ad`) — 「下書き / 輪郭」。 sketch 重視で良い名だが、 spec 連携の含意は弱い
- Compages (`Cp`) — 「骨組み / 結合構造」。 やや硬派
- Tabula (`Tb`) — 「板 / 計画表」。 tabula rasa の連想で覚えやすい
- Schema (`Sc`) — 「設計図」。 database schema と紛らわしい
- Designare — 「指図する」。 動詞由来でやや堅い

PROJECT-CODES.md への追記 (`Pf` = Praeforma) は別途実施。

---

## 11. Acceptance Test の詳細

### 11.1 そもそも acceptance とは

仕様 (`specs` テーブル) の各行に紐付く 「**この仕様が満たされたと判定する条件**」
の集合。 機能要件 §F3 の `acceptance:` 配列がそれにあたる。

```yaml
spec:
  id: SPEC-001-PLAYER-MOVE
  title: WASD で 8 方向移動
  acceptance:
    - キー入力なしのフレームでは位置が変わらないこと
    - 速度は ドメイン定義の `speed` 属性に従う
    - 斜め入力時 (例: W+D) は単一方向と同じ速度
```

acceptance 条件は **「人が読める日本語」** と **「機械が判定できる述語」** の
両方を併記する。 v1 では下の 3 段階を全部サポートする:

| level | 判定方法 | 例 |
|---|---|---|
| `manual` | 人が play してチェックリストで確認 | 「キャラが破綻なく走るように見えること」 |
| `assertion` | runtime state を probe して predicate 評価 | `object('player').velocity.x === domain('Player').attrs.speed when input.D` |
| `event` | runtime event 列を観察してパターン照合 | `within 0.5s after event('player.spotted')`, `event('enemy.chase.start') emitted` |

### 11.2 データモデル

```
specs
├── id, project_id, title, description, priority, ...
└── (1:N)
    spec_acceptance
    ├── id, spec_id, ordinal
    ├── text          — 人が読む文 (= レビュー / 手動 QA でも使う)
    ├── level         — 'manual' | 'assertion' | 'event'
    ├── expression    — predicate / DSL (level != manual のとき必須)
    └── kind          — 'positive' | 'negative' (満たすべき / 起きてはならない)

acceptance_runs       — 1 回のテスト実行 = 1 run
├── id, project_id, layout_id, platform ('web' | 'unity' | ...)
├── started_at, finished_at, triggered_by (user_id)

acceptance_results    — run × acceptance 行 1 件ずつ
├── run_id, acceptance_id
├── status            — 'pass' | 'fail' | 'skip' | 'error'
├── observed          — 観測値 (失敗時の debug 用 JSON)
├── started_at, duration_ms
└── log_excerpt       — 関連ログ 1KB 程度
```

### 11.3 Runtime probe (level=`assertion` の評価器)

Web / Unity の **PraeformaRuntime** が共通で公開する probe API:

```ts
// 共通 probe (JSON-RPC over WebSocket / or local function call)
probe.objects(query): Object[]    // 配置中の object を query で抽出
probe.object(id): Object          // 単一 object の現在 transform / attrs / state
probe.domain(name): DomainMeta    // ドメイン定義 (= 静的 spec)
probe.input(key): boolean         // 入力 (キー / マウス) の現在状態
probe.events(filter): Event[]     // ringbuffer (直近 1000 イベント) を query
probe.time(): { frame, t_sec }    // フレーム / 経過秒
probe.advance(frames): void       // フレームを進める (= deterministic 再生時のみ)
```

`expression` の DSL は最初は **JS 式評価** (vm2 / QuickJS) で始める:

```js
// SPEC-001-PLAYER-MOVE の acceptance 例
probe.input('D') && probe.object('player').velocity.x > 0
&& probe.object('player').velocity.x === probe.domain('Player').attrs.speed
```

将来的に **Gherkin (Given/When/Then)** で書きたい人向けの変換層を入れる。

### 11.4 Event-pattern (level=`event` の評価器)

時間軸を持つ要件 (= 「敵に視認されたら 0.5 秒以内に追跡開始」 等) は probe
だけだと書けないので、 event log を pattern match する。

```yaml
acceptance:
  - level: event
    text: "Enemy が Player を視認後 0.5 秒以内に追跡を始めること"
    expression: |
      within(0.5s) {
        after  event('Enemy.spotted')
        expect event('Enemy.chase.start')
      }
```

実装は 「event ringbuffer に対する小さな pattern matcher」 (= 状態機械)。

### 11.5 実行フロー (Web / Unity 共通)

```
[trigger]
  preview tab で 「Run acceptance」 ボタン or cron / CI
[setup]
  Praeforma backend が新しい acceptance_run 行を作成
  対象 layout + spec 集合を runtime に push (WebSocket)
[run]
  Runtime が:
    1. layout を構築 (placeholder + assets で)
    2. spec 毎に input script を再生 (= 「W を 1s 押す」 等)
    3. 各 acceptance を probe / event で評価
    4. acceptance_results に書き込み
[result]
  Editor に集計が出る (✓ pass / ✗ fail で object をマーカ表示)
  fail 行は observed JSON + log_excerpt をクリックで展開
```

### 11.6 v1 で必須 / v2 以降

| | v1 (MVP) | v2+ |
|---|---|---|
| level=manual | ✓ | (UI で 「チェック済」 ボタン) |
| level=assertion | ✓ (JS 式) | Gherkin / 独自 DSL 互換層 |
| level=event | ✓ (基本 within / sequence / count) | 階層 / 並行 pattern |
| run trigger | 手動 + 自動 (file save) | CI integration |
| platform | Web + Unity の両方 | platform 別 expected diff |
| 並列実行 | 単一 layout 単一 spec | layout × seed 行列 |

### 11.7 何を 「実装可能」 にしないか

- 数値ピクセル比較 (= screenshot diff) は対象外 (= Figma などの別ツール役割)
- 物理シミュレーションの厳密一致 (= 物理エンジン依存) は対象外
- 「絵が綺麗かどうか」 は対象外

---

## 12. Collaboration (Cernere 連携前提)

### 12.1 認証 / セッション

- Cernere SSO を **必須**とする。 ローカル単独 mode は持たない (= 個人用は
  ローカル Cernere を 1 セッションで使う運用)
- Web frontend は `@ludiars/cernere-composite` で popup login → service_token
- Unity Editor 拡張は同じ composite flow を URL handler で受ける (= Unity 内
  ブラウザ or system browser → custom URL scheme `praeforma://auth?code=...`)
- Backend は `@ludiars/cernere-id-cache` で service_token を local verify

### 12.2 プロジェクト ↔ 組織 / メンバー / ロール

- 1 project は 1 Cernere organization に属する (= LUDIARS 標準パターン)
- メンバーは role を持つ:
  - `owner` — project 削除 / メンバー管理 / role 変更
  - `planner` — オブジェクト / ドメイン / spec の編集
  - `designer` — asset 差し替え + placeholder transform 編集 (lock 解除分のみ)
  - `programmer` — spec 閲覧 + acceptance 実行 + acceptance_results 閲覧
  - `reviewer` — spec の review / comment 専用 (編集権限なし)
  - `viewer` — 閲覧のみ
- role と編集対象 (table x action) のマトリクスは [spec/schema/collab.md] で定義

### 12.3 リアルタイム同期 (WebSocket)

- バックエンドが `/ws/edit?project=<id>` WebSocket を提供
- Frontend / Unity Editor は同 socket に接続して以下を流す:
  - 自分のカーソル / 選択 object id (= プレゼンス)
  - edit op (object move / spec update / asset link 等) を **operation log**
    として全 client に broadcast
- 競合は 「**field-level Last-Writer-Wins**」 を既定 (= 同じ object.transform を
  同時に編集したら、 後に着いた write が勝つ)
- 重要な field (= spec.acceptance / role 等) は **楽観ロック** (version 列 +
  CAS) で fail-fast。 conflict resolution UI に上げる
- relay 経路は Cernere の `relay` 機能を活用しても、 Praeforma 専用 WS でも可。
  MVP は Praeforma 専用 (= 実装が単純)

### 12.4 監査 (audit_log)

全 edit op を `audit_log` に追記 (= 「いつ / 誰が / どの object を / どう変えたか」)。
Cernere の operation_logs と二重持ちにはせず、 Praeforma 内で完結させる
(= 細粒度すぎて Cernere に逐一は流さない)。 集計 (例: 「今週の編集量」 等)
は Praeforma backend が自前で行う。

### 12.5 オフライン編集

- ネット切断時は read-only 動作 (= edit op を queue に積むが反映しない)
- 復帰時に queue を吐き出して merge する。 conflict は §12.3 のルールに従う
- これにより、 デザイナーが現場で iPad / Surface を持ち出しても破綻しない
  (ただし conflict 量が増えるので長時間オフラインは非推奨)

### 12.6 個人データの扱い (LUDIARS ルール)

- Cernere が user の単一情報源。 Praeforma DB には `user_id` (Cernere UUID) と
  必要時の `display_name` snapshot のみ持つ (Memoria Hub と同じパターン)
- email / 認証 token は Praeforma に保管しない
- audit_log の actor は user_id のみ。 display 時に Cernere から resolve
