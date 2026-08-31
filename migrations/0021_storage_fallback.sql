CREATE TABLE `search_index_shards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shard_key` text NOT NULL,
	`shard_index` integer NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_index_shards_key_idx` ON `search_index_shards` (`shard_key`,`shard_index`);--> statement-breakpoint
CREATE TABLE `used_challenges` (
	`challenge` text PRIMARY KEY NOT NULL,
	`used_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `used_challenges_used_at_idx` ON `used_challenges` (`used_at`);--> statement-breakpoint
CREATE TABLE `kv_rate_limit_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`daily_write_count` integer DEFAULT 0 NOT NULL,
	`last_write_date` text NOT NULL,
	`auto_disabled` integer DEFAULT false NOT NULL,
	`restored_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `kv_rate_limit_state_id_singleton` CHECK (`kv_rate_limit_state`.`id` = 1)
);
--> statement-breakpoint
CREATE TABLE `task_progress` (
	`task_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`progress_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_progress_type_idx` ON `task_progress` (`type`);--> statement-breakpoint
CREATE TABLE `cf_alert_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cf_alert_state_day_idx` ON `cf_alert_state` (`day`);--> statement-breakpoint
CREATE TABLE `post_auto_snapshot_throttle` (
	`post_id` integer PRIMARY KEY NOT NULL,
	`queued_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`detail_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `storage_log_created_idx` ON `storage_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `storage_log_event_idx` ON `storage_log` (`event`);
