-- GoreeCloud Mail durable state blueprint
--
-- This schema intentionally stores provider-account metadata and synchronization
-- state separately from reusable provider secrets. Secret values belong in the
-- approved credential-vault implementation, not in these tables.

CREATE TABLE provider_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_account_id TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, provider, external_account_id)
);

CREATE INDEX provider_accounts_user_idx
  ON provider_accounts (user_id, provider);

CREATE TABLE provider_credential_refs (
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  vault_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, account_id),
  FOREIGN KEY (account_id) REFERENCES provider_accounts(id) ON DELETE CASCADE
);

CREATE TABLE oauth_authorization_state (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  redirect_path TEXT NOT NULL,
  pkce_verifier_ref TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX oauth_authorization_state_expiry_idx
  ON oauth_authorization_state (expires_at);

CREATE TABLE sync_cursors (
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  cursor_type TEXT NOT NULL,
  cursor_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, account_id, cursor_type),
  FOREIGN KEY (account_id) REFERENCES provider_accounts(id) ON DELETE CASCADE
);

CREATE TABLE mailbox_cache_state (
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  last_successful_sync_at TEXT,
  last_attempted_sync_at TEXT,
  last_error_code TEXT,
  PRIMARY KEY (user_id, account_id, mailbox_id),
  FOREIGN KEY (account_id) REFERENCES provider_accounts(id) ON DELETE CASCADE
);
