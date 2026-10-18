# 断片スプリント

機能仕様: spec/feature/fragment-sprints.md

- spec_sprints: id主キー (ULID)、project_id、title (1〜200 文字)、goal (0〜2000 文字、既定 '')、created_by、created_at (ISO文字列)。
- spec_sprint_fragments: fragment_id主キー (断片は同時に 1 スプリントのみ)、sprint_id、added_by、added_at (ISO文字列)。

段階・件数は保存しない。spec_fragments の implementation_state と spec_reconstruction_fragments から毎回計算する。
除外は spec_sprint_fragments の行削除で行い、断片・実装状態・版履歴は変更しない。体系化済 (spec_reconstruction_fragments に行がある) 断片の行は削除しない。

migration: server/migrations/027_spec_sprints.sql (PostgreSQL)、server/src/db/spec-sprint-sqlite.ts (ローカル SQLite)。
