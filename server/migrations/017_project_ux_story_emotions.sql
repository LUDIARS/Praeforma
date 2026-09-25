-- UX/Goal にストーリー (カスタマージャーニー) と、かかわる感情の定義を足す
-- (spec/feature/project-ux-goal.md PF-GOAL-W2)。追加列のみで、既存プロジェクトは空欄のまま。
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_story TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ux_emotions TEXT NOT NULL DEFAULT '';
