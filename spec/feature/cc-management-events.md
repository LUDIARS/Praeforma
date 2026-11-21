# Concordia への仕様変更通知

Gen5 Step 2。Praeforma に保存された主要な設計変更を CDGD の変更列へ届ける。
実装参照は `actio:8242b9ff-479c-4086-835a-6eaca5be26f8`。受信契約は Concordia の
`spec/feature/cdgd-management.md` CC-MGMT-02 `POST /v1/management/events`。

## 通知する保存

| 対象 | 保存経路 | `kind` |
| --- | --- | --- |
| 仕様 | 体系仕様の作成・更新・削除、対象と受入条件の差し替え、仕様断片の新規登録、再構成の確定、会話から適用された仕様提案 | `spec-created` / `spec-updated` / `spec-deleted` |
| シーン | レイアウトの作成・更新・削除、配置の差し替え、シーンエディターでの保存 | `scene-created` / `scene-updated` / `scene-deleted` |
| ドメイン | ドメインの作成・更新・削除、価値定義、業務ドメインの所属、要件への関連付け | `domain-created` / `domain-updated` / `domain-deleted` |

通知は保存完了後に積む。失敗した保存、仕様断片の同一入力による再取得、未確定の AI 提案は対象外。
通常の編集は `origin=human` とし、仕様の AI 再構成の確定と、会話による AI 仕様提案の適用は `origin=ai` とする。
監査を経由する保存は `management-audit-actions.ts` が通知の種別に対応付ける。

## ペイロードと配送

- `source` は `pf`。Praeforma に専用のプロジェクトコード列がないため、`project_code` は DB のプロジェクト ID とする。Cc の任務には同じ値を設定する。形式外の場合は `pf-` と SHA-256 の先頭 32 桁を使う。
- `target_key` は `spec/<id>`、`scene/<id>`、`domain/<id>`。対象 ID は体系仕様・断片・再構成、レイアウト、ドメインの各保存 ID を使う。長すぎる ID や形式外の ID は SHA-256 に置き換える。
- `event_key` は `pf:<entity>:<digest>`。ダイジェストは UTF-8 の JSON 配列 `[projectId, targetId, changeId]` の SHA-256（小文字 64 桁）。変更識別子には保存後に記録された監査行の ID、断片の作成、再構成の確定、または提案メッセージ ID と提案の位置を使う。キュー内の再送はペイロード全体を保持する。
- `summary` は対象の種類と操作を伝える定型文で、Cc の上限は UTF-16 で 2000 コード単位。自由記述、保存内容、利用者情報、認証情報を含めない。`observed_at` は保存時の ISO 8601 時刻を Concordia が受け付ける Unix epoch ミリ秒に変換する。
- `CONCORDIA_MANAGEMENT_EVENTS_URL` を優先し、空なら `CONCORDIA_URL` のオリジン上の `/v1/management/events` を使う。両方未設定または有効な設定値が `off` の場合は無効。HTTPS と loopback HTTP を許可し、URL の認証情報、クエリ、フラグメントを拒否する。認証ヘッダーを付けず、リダイレクト先には送信しない。
- 保存経路はネットワーク応答を待たない。配送は一度に 1 件、タイムアウトは 5 秒。2xx は配送済み、4xx は拒否としてキューから除去し、5xx・通信失敗・その他の応答は同じ内容で再送する。再送間隔は 5 秒から倍増し、上限は 5 分。
- キューはプロセス内に最大 1000 件を保持する。満杯の間は追加分を破棄し、再起動時は保留分を失う。既存データの遡及送信は行わない。配送障害から保存処理を独立させるため、既存の監査フックと配送キューを使う。
- `management-events.ts` が配送の開始・終了とキュー投入を扱い、`management-event-payload.ts` が内容を組み立てる。HTTP 送信は `management-events-client.ts`、再送と終了時の中断は `management-event-queue.ts` が扱う。
