# data_designs

正本: プロジェクトごとのデータ設計文書。機能契約は `spec/feature/data-design.md`。

| 列 | PostgreSQL | SQLite | 契約 |
|---|---|---|---|
| project_id | text PK, FK projects.id | text PK, FK projects.id | 1 プロジェクト 1 文書 |
| definition | jsonb NOT NULL | JSON text NOT NULL | schemaVersion=1、datasets 配列 |
| revision | integer NOT NULL | integer NOT NULL | 保存ごとに +1、初回 1 |
| updated_by | text NOT NULL | text NOT NULL | 更新者の Cernere UUID / 明示 local identity |
| created_at | timestamptz NOT NULL | epoch ms INTEGER NOT NULL | UTC |
| updated_at | timestamptz NOT NULL | epoch ms INTEGER NOT NULL | UTC |

未登録の GET は revision=0 の空設計を返す。初回 PUT は INSERT ON CONFLICT DO NOTHING、以後は revision を条件に UPDATE し、競合を成功扱いしない。プロジェクトの論理削除判定も保存 SQL の条件に含める。

datasets は最大 100、各 fields は最大 100。ID は UUID、dataset name は文書内で、field name は dataset 内で一意。referenceFieldId は同じ文書の項目 ID を指す。削除した項目は設計から除くのみで、実データや実列の削除は行わない。

各項目の storage は識別可能な union。cernere_profile は許可された共通プロフィール項目の参照、cernere_project は projectKey / module / column、service_db / local / object_storage は論理的な location の説明を持つ。unassigned は未設計を明示する。

| データ | 種類 | 権威ソース | 保存先 | 保護 | 方法 |
|---|---|---|---|---|---|
| スキーマ設計・保存先対応付け | user（設計者が編集するドメインデータ） | Praeforma | 本テーブル | 必要 | プロジェクト所属・役割でアクセス制御。設計内容を監査ログへ複製しない |
| 更新者 ID | user | Cernere（local mode は匿名固定 ID） | UUID アンカーのみ本テーブル | 必要 | プロジェクト内の更新履歴用途。プロフィール・credential を複製しない |

保存期間は対象プロジェクトの保持期間に従う。プロジェクト論理削除後は API で閲覧・更新できず復旧用に保持する。取得結果はキャッシュの TTL を持つ別の正本へ保存しない。ダウンロードした設計書の保管・削除は利用者が管理する。

PostgreSQL migration: `server/migrations/010_data_designs.sql`。SQLite は既存の初期化 DDL に冪等な CREATE を追加する。
