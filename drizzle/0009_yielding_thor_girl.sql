ALTER TABLE `notification_settings` ADD `quiet_start` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `quiet_end` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `default_minutes` integer DEFAULT 30 NOT NULL;