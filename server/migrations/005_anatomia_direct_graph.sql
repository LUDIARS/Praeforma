-- Praeforma 005 — Studio の Anatomia 直接取得へ移行
--
-- 003 の MUSA relay 未設定状態を、直接接続の設定不足状態へ置き換える。
-- 過去 migration は変更せず、既存データを保持したまま CHECK を差し替える。

ALTER TABLE code_graph_runs DROP CONSTRAINT IF EXISTS code_graph_runs_status_check;
UPDATE code_graph_runs
SET status = 'anatomia_unconfigured'
WHERE status = 'musa_unconfigured';
ALTER TABLE code_graph_runs ADD CONSTRAINT code_graph_runs_status_check
  CHECK (status IN ('ok', 'error', 'anatomia_unconfigured'));
