ALTER TABLE `posts` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `password_cipher` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `password_channel` text;