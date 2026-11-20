CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`record_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
