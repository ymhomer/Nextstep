CREATE TABLE passkeys (
 id TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 public_key TEXT NOT NULL,
 counter INTEGER NOT NULL DEFAULT 0,
 transports TEXT NOT NULL DEFAULT '[]',
 name TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 last_used_at INTEGER
);
--> statement-breakpoint
CREATE TABLE webauthn_challenges (
 token_hash TEXT PRIMARY KEY NOT NULL,
 challenge TEXT NOT NULL,
 kind TEXT NOT NULL,
 account_id TEXT,
 password_version TEXT,
 expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE notification_settings (
 user_id TEXT PRIMARY KEY NOT NULL,
 invite_code TEXT NOT NULL,
 reminders INTEGER NOT NULL DEFAULT 1,
 updates INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX notification_settings_invite_code_unique ON notification_settings(invite_code);
--> statement-breakpoint
CREATE TABLE notifications (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 workspace_id TEXT NOT NULL DEFAULT '',
 kind TEXT NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 invite_id TEXT,
 created_at INTEGER NOT NULL,
 read_at INTEGER
);
--> statement-breakpoint
CREATE INDEX notifications_user_created ON notifications(user_id,created_at);
--> statement-breakpoint
CREATE TABLE notification_reads (
 user_id TEXT NOT NULL,
 notification_id TEXT NOT NULL,
 read_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,notification_id)
);
--> statement-breakpoint
ALTER TABLE workspace_invites ADD recipient_id TEXT;
--> statement-breakpoint
ALTER TABLE workspace_invites ADD declined_at INTEGER;
