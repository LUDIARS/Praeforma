# 仕様バージョン

プロジェクトごとの仕様全体の番号。既存のspec.version（行の楽観ロック）とは別。

- spec_version_heads: project_id主キー、major/minor/patch、revision、suppress（トランザクション内の統合処理で追加通知をまとめる）。初期0.0.0。
- spec_version_logs: id主キー、project_id、version、revision（発行順）、kind、payload（変更前後・出典）、created_at（ISO文字列）。project_id/version一意。追加専用。同時刻でもrevision順で表示する。
- spec_reconstructions: id主キー、project_id、payload（入力、統合案）、confirmed_version nullable。
- spec_reconstruction_fragments: fragment_id主キー、reconstruction_id。確定した出典を再度統合しない。元フラグメントは保持。

仕様/フラグメントのINSERTトリガーでパッチ番号と履歴を同じトランザクションで追加する。再送でINSERTされなければ増えない。レコンストラクションは確定時のみマイナー+1/パッチ0。リリースは仕様画面で明示的に記録した際にメジャー+1/マイナー0/パッチ0（配布・デプロイ操作ではない）。

確定・リリースはhead.revisionを比較し、二重実行を拒否する。統合時は構造化仕様の行versionと入力フラグメントrevisionも比較し、仕様の変更、出典消費、履歴、番号を一括commitする。
