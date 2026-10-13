-- spec/data/schema/spec.md / spec/feature/deferred-planning.md「数値計測と契約」。
-- 構造化仕様に計測 (指標・単位・方法・期間・目標・実測) と契約 (条件・判定・報酬・付与時点・例外) を記載する。
-- 既存仕様は空配列で始める。未計測を 0 で埋めない (observed は null)。
ALTER TABLE specs ADD COLUMN IF NOT EXISTS measurements jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE specs ADD COLUMN IF NOT EXISTS contracts jsonb NOT NULL DEFAULT '[]'::jsonb;
