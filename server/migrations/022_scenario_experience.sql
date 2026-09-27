-- SPEC-PF-SCENARIO-EXPERIENCE: preserve legacy content; do not invent an experience.
ALTER TABLE ux_scenarios ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'gameplay';
ALTER TABLE ux_scenarios ADD COLUMN IF NOT EXISTS experience text NOT NULL DEFAULT '';
ALTER TABLE ux_scenarios ADD COLUMN IF NOT EXISTS visual_direction text NOT NULL DEFAULT '';
