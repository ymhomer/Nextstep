CREATE TABLE push_subscriptions (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 endpoint TEXT NOT NULL,
 p256dh TEXT NOT NULL,
 auth TEXT NOT NULL,
 device_hash TEXT NOT NULL,
 name TEXT NOT NULL,
 show_details INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 last_status INTEGER,
 last_sent_at INTEGER
);
--> statement-breakpoint
CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);
--> statement-breakpoint
CREATE INDEX push_subscriptions_device ON push_subscriptions(device_hash);
--> statement-breakpoint
CREATE TABLE push_deliveries (
 notification_id TEXT NOT NULL,
 subscription_id TEXT NOT NULL,
 next_attempt INTEGER NOT NULL,
 delivered_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(notification_id,subscription_id)
);

--> statement-breakpoint
ALTER TABLE notifications ADD task_id TEXT;
--> statement-breakpoint
ALTER TABLE notification_settings ADD time_zone TEXT NOT NULL DEFAULT 'UTC';
--> statement-breakpoint
ALTER TABLE notification_settings ADD reminder_hour INTEGER NOT NULL DEFAULT 9;
--> statement-breakpoint
CREATE TABLE push_job_state (
 id TEXT PRIMARY KEY NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0,
 last_run_at INTEGER
);

--> statement-breakpoint
ALTER TABLE notification_settings ADD timezone_set INTEGER NOT NULL DEFAULT 0;
