-- spec/data/schema/deferred-planning.md「処理結果」。
-- 再構築の確定で処理済みになった断片に、統合 (integrated) か棄却 (rejected) かと棄却理由を持たせる。
-- 既存行はすべて統合で確定したものなので integrated で始める。原文 (spec_fragments) は消さない。
ALTER TABLE spec_reconstruction_fragments ADD COLUMN IF NOT EXISTS disposition TEXT NOT NULL DEFAULT 'integrated';
ALTER TABLE spec_reconstruction_fragments ADD COLUMN IF NOT EXISTS reason TEXT;
