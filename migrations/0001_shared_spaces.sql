CREATE TABLE shared_spaces (
  id TEXT PRIMARY KEY NOT NULL,
  access_token_hash TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  format_version INTEGER NOT NULL CHECK (format_version = 1),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  last_operation_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX shared_spaces_expiry ON shared_spaces(expires_at);
