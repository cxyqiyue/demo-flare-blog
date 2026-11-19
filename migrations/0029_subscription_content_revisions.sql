ALTER TABLE `post_notifications` ADD `content_hash` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `moment_notifications` (
	`moment_id` integer PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`moment_id`) REFERENCES `moments`(`id`) ON UPDATE no action ON DELETE cascade
);
