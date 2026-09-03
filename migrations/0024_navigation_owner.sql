ALTER TABLE `search_engines` ADD `owner_id` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX `search_engines_owner_idx` ON `search_engines` (`owner_id`);
--> statement-breakpoint
ALTER TABLE `bookmark_folders` ADD `owner_id` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX `bookmark_folders_owner_idx` ON `bookmark_folders` (`owner_id`);
--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `owner_id` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX `bookmarks_owner_idx` ON `bookmarks` (`owner_id`);
