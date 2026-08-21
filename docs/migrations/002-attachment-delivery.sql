-- GoreeCloud Mail schema migration 2
-- Durable attachment-delivery metadata only. Attachment bytes remain in the
-- private attachment store; reusable provider secrets remain in the credential vault.

CREATE TABLE IF NOT EXISTS attachment_delivery_records (
  object_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  declared_mime_type TEXT NOT NULL,
  sniffed_mime_type TEXT,
  actual_size INTEGER NOT NULL CHECK (actual_size >= 0),
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (account_id) REFERENCES provider_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS attachment_delivery_owner_idx
  ON attachment_delivery_records (user_id, account_id, created_at);

CREATE INDEX IF NOT EXISTS attachment_delivery_expiry_idx
  ON attachment_delivery_records (expires_at);
