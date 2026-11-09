-- spec/feature/repo-data-branch.md: プロジェクト名とリポジトリのフォルダ名が違うときの保存先。
ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo_data_dir TEXT;
