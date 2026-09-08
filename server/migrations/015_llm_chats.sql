CREATE TABLE IF NOT EXISTS llm_chats (
  project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0, data TEXT, PRIMARY KEY (project_id, user_id)
);
