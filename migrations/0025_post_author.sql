ALTER TABLE `posts` ADD `author_id` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE INDEX `author_id_idx` ON `posts` (`author_id`);
