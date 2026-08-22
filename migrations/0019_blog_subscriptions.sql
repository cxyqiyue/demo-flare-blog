CREATE TABLE `blog_subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_notifications` (
	`post_id` integer PRIMARY KEY NOT NULL,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL
);
