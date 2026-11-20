CREATE TABLE `task_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text DEFAULT '' NOT NULL,
	`task_id` text NOT NULL,
	`mode` text NOT NULL,
	`at` integer,
	`anchor` text DEFAULT 'start' NOT NULL,
	`offset_minutes` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_reminders_owner_task` ON `task_reminders` (`user_id`,`workspace_id`,`task_id`);