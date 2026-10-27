CREATE TABLE tasks (
 id TEXT PRIMARY KEY NOT NULL,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),
 description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),
 due_date TEXT CHECK(due_date IS NULL OR (length(due_date)=10 AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 completed_at TEXT,
 CHECK((status='completed' AND completed_at IS NOT NULL) OR (status='pending' AND completed_at IS NULL))
);
CREATE INDEX tasks_status_due ON tasks(status, due_date);
CREATE INDEX tasks_completed ON tasks(completed_at DESC);
