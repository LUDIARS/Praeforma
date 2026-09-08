# デファードプランニングの保存契約案

関連: spec/feature/deferred-planning.md。フラグメント保存はmigration 011_spec_fragments.sqlで追加する。再構築・相談のDDLは後続実装で定義する。

| データ | 種類 | 正本/保存先 | 保護 |
| --- | --- | --- | --- |
| 仕様フラグメント・訂正関係・出所 | user | PfのPostgreSQL。ローカル運用はPf SQLite | プロジェクト権限で保護。原文をログ/例外へ出さない |
| 構造化仕様・再構築版・統合対応 | user | Pf DB | プロジェクト権限、確定権限、版比較、履歴保持 |
| 実装状態・版付き根拠 | user | Pf DB | プロジェクト権限と変更者ID参照。氏名や認証情報を複製しない |
| 会話・再構築案・実行記録 | user | Pf DB | メンバー限定。外部へ渡す文脈を対象プロジェクトに限定 |
| Cc送信待ちイベント | user | Cc DB。受信確定後の仕様の正本はPf | 既存Ccの認可に従い、配信IDと確認結果を保持。二重送信に耐える |
| 個人属性・認証情報 | user | Cernere/既存認証基盤 | PfにはID参照のみ。秘密情報は仕様入力へ埋め込まない |

仕様は利用者が作成するためuserに分類する。認可は既存のプロジェクト所属を利用し、ローカルモードを外部サービスの管理者権限として流用しない。

PostgreSQL/SQLiteの両方で受信元イベントの一意性、再構築確定の原子性、履歴参照を担保する。送信元のIDからPfプロジェクトへの対応がない場合は、未配送として観測できる形で残す。

既存specsの承認状態・編集版・関連対象を維持し、実装状態を推測で埋めない。不要断片の通常表示からの除外と原文削除は別操作にする。

## 第一段階: spec_fragments

原文content、project_id、source、source_event_id、created_by、created_atは作成後不変。原文には計測値や条件・報酬の自由記述をそのまま保持する。Pf UIからはsourceを指定できず、サーバがpfを付ける。Ccを名乗る入力は受け付けない。

project_id/source/source_event_idを一意にする。同一イベントの同一作者・同一原文による再送は既存行を返す。同じイベントIDで異なる本文/作者の場合は409。別イベントの同文は別断片となる。

implementation_stateはunverified/unimplemented/implemented。新規断片は未実装で始まり、実装済にはimplementation_evidenceを必須とする。変更者・変更時刻・revisionを保存する。状態変更はexpectedRevisionのCASで競合を拒否し、原文を書き換えない。

### API

- GET /api/projects/:pid/spec-fragments: limit/offsetによる一覧、hasMore、canEdit。
- POST /api/projects/:pid/spec-fragments: content（最大20000文字、空白のみ不可）、sourceEventId（UUID）。201で新規、200で再送、409でイベント衝突。
- PATCH /api/projects/:pid/spec-fragments/:fid/implementation: expectedRevision、implementationState、implementationEvidence（最大4000文字）。別プロジェクトや削除済プロジェクトを操作しない。

閲覧は全メンバー、登録/状態変更はowner/planner/designer/programmer/reviewer。viewerは読み取りのみ。監査に必要な作者・変更者はIDで記録する。承認状態や構造化状態とは独立。

### 回帰確認

RevisorでSQLite/PGの移行、同一イベント再送、別イベント同文、衝突409、CAS競合、viewer拒否、別プロジェクト/削除済プロジェクト拒否、空白・過大入力拒否、原文の改行と数値/条件/報酬の保存を確認する。UIの再送・エラー時の入力保持と既存仕様focusリンクを確認する。
