# プロジェクトの制約

2026-09-26 neco 指示「『制約』をタブに追加し、企画的な制約は UX を縛るものとして UX ページに表示する」。

企画・技術・運用などで守る条件を、プロジェクトごとに 1 件ずつ持つ。
企画の制約は UX を縛るものとして UX タブにも読み取り専用で並べ（[project-ux-goal.md](project-ux-goal.md) PF-GOAL-W4）、
企画概要書の材料にも入れる（[concept-sheet.md](concept-sheet.md)）。

## 要件

- PF-CON-1: 制約は 種類（企画 `planning` / 技術 `technical` / 運用・その他 `other`）、見出し（1 行・80 字まで、改行不可）、
  説明（任意・4000 字まで）を持つ。1 プロジェクト 200 件まで。一覧は 企画 → 技術 → 運用・その他 の順に、種類の中は作った順に並べる。
- PF-CON-2: 更新・削除は版一致（expectedRevision）で行い、古い版での上書き・削除は 409 にする。
  保存の失敗や競合で入力を消さない。
- PF-CON-3: 企画の制約だけを UX タブの「この UX を縛る制約」に読み取り専用で出し、制約タブへ移れるようにする。
  取得に失敗したときは「制約なし」と扱わない。
- PF-CON-4: プロジェクトごとに分離する。別プロジェクトの制約は見えず、更新・削除もできない（404）。

閲覧はプロジェクトメンバー全員。作成・更新・削除は owner / planner / designer（UX を編集できる人と同じ）。

## API

`/api/projects/:pid/constraints`

| 操作 | 内容 |
|---|---|
| `GET /` | 一覧。`{canEdit, items:[{id,kind,title,detail,revision,createdAt,updatedAt}]}` |
| `POST /` | `{kind, title, detail?}`。201 `{constraint}` |
| `PUT /:id` | `{kind, title, detail, expectedRevision}`。版不一致は 409 |
| `DELETE /:id?expectedRevision=` | 削除。版不一致は 409、無ければ 404 |

保存形式は [spec/schema/project-constraints.md](../schema/project-constraints.md)。

## 実装

| ファイル | 責務 |
|---|---|
| shared/project-constraint.ts | 種類・上限・型 |
| server/src/db/schema/project-constraint.ts / server/src/db/project-constraint-sqlite.ts | 表（Postgres / SQLite） |
| server/src/routes/project-constraints.ts | 権限・版一致・プロジェクトの分離 |
| web/src/lib/project-constraints-api.ts | 呼び出しと失敗の言い換え |
| web/src/components/ProjectConstraints.tsx | 制約タブ |
| web/src/components/UxBindingConstraints.tsx | UX タブの「この UX を縛る制約」 |

## 検証

`server/src/lib/__tests__/project-constraints.test.ts`（作成・一覧の順・改行の拒否・版一致の更新と削除・別プロジェクト・権限・
UX の target 保存と価値/コンセプトの改行拒否・企画概要書の材料に企画の制約だけが入ること）。
単体・動作テストは明示の許可があるときに行う。反映には本体での build と Excubitor 経由の再起動が要る（SQLite は起動時に表を作る、Postgres は migration 020）。
