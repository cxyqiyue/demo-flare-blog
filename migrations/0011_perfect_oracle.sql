CREATE TABLE `moment_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`moment_id` integer NOT NULL,
	`content` text,
	`status` text DEFAULT 'published' NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`moment_id`) REFERENCES `moments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `moment_comments_moment_created_idx` ON `moment_comments` (`moment_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `moment_comments_status_idx` ON `moment_comments` (`status`);--> statement-breakpoint
CREATE TABLE `moment_likes` (
	`moment_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`moment_id`, `user_id`),
	FOREIGN KEY (`moment_id`) REFERENCES `moments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `moment_likes_moment_created_idx` ON `moment_likes` (`moment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `moments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text,
	`images` text DEFAULT '[]' NOT NULL,
	`author_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `moments_created_idx` ON `moments` (`created_at`);