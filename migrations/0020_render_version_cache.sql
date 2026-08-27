ALTER TABLE `about_article` ADD `rendered_html` text;--> statement-breakpoint
ALTER TABLE `about_article` ADD `render_version` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `public_content_render_version` text;
