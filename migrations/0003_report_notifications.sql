ALTER TABLE school_reports ADD COLUMN email_sent_at INTEGER;
ALTER TABLE school_reports ADD COLUMN email_attempted_at INTEGER;
ALTER TABLE school_reports ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX school_reports_email_pending ON school_reports(email_sent_at, email_attempted_at) WHERE email_sent_at IS NULL;
