CREATE TABLE school_reports (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('closed', 'hours', 'address', 'other')),
  email TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX school_reports_expiry ON school_reports(expires_at);
CREATE INDEX school_reports_created ON school_reports(created_at);
