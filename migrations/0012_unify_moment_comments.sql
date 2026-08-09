PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text,
	`root_id` integer,
	`reply_to_comment_id` integer,
	`status` text DEFAULT 'verifying' NOT NULL,
	`ai_reason` text,
	`post_id` integer,
	`moment_id` integer,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`root_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_to_comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moment_id`) REFERENCES `moments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_comments`("id", "content", "root_id", "reply_to_comment_id", "status", "ai_reason", "post_id", "moment_id", "user_id", "created_at", "updated_at") SELECT "id", "content", "root_id", "reply_to_comment_id", "status", "ai_reason", "post_id", "moment_id", "user_id", "created_at", "updated_at" FROM `comments`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
ALTER TABLE `__new_comments` RENAME TO `comments`;--> statement-breakpoint
INSERT INTO `comments`("content", "status", "moment_id", "user_id", "created_at", "updated_at") SELECT "content", "status", "moment_id", "user_id", "created_at", "updated_at" FROM `moment_comments`;--> statement-breakpoint
DROP TABLE `moment_comments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `comments_post_root_created_idx` ON `comments` (`post_id`,`root_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_moment_created_idx` ON `comments` (`moment_id`,`root_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_user_created_idx` ON `comments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_status_created_idx` ON `comments` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_global_created_idx` ON `comments` (`created_at`);
