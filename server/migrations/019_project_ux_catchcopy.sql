-- UX/Goal にキャッチコピーを足す (spec/feature/project-ux-goal.md PF-GOAL-W3)。
-- 人が考えた文言を企画概要書がそのまま採用する。空のときだけ Astra の案が入り、origin で人の文言と区別する。
-- origin: '' (空) / 'human' (人が保存) / 'ai' (Astra が空欄を埋めた)。追加列のみで、既存プロジェクトは空欄のまま。
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_catchcopy TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_catchcopy_origin TEXT NOT NULL DEFAULT '';
