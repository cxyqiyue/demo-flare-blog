CREATE TABLE `bookmark_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bookmark_folders_order_idx` ON `bookmark_folders` (`sort_order`);--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`folder_id` integer,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `bookmark_folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmarks_folder_order_idx` ON `bookmarks` (`folder_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `bookmarks_folder_id_idx` ON `bookmarks` (`folder_id`);--> statement-breakpoint
CREATE TABLE `search_engines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url_template` text NOT NULL,
	`icon_url` text,
	`domain` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_engines_order_idx` ON `search_engines` (`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `search_engines_default_unique` ON `search_engines` (`is_default`) WHERE "search_engines"."is_default" = 1;
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('百度', 'https://www.baidu.com/s?wd={query}', 'www.baidu.com', 1, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('必应 Bing', 'https://www.bing.com/search?q={query}', 'www.bing.com', 2, 1, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('搜狗', 'https://www.sogou.com/web?query={query}', 'www.sogou.com', 3, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('Google', 'https://www.google.com.hk/search?q={query}', 'www.google.com.hk', 4, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('GitHub', 'https://github.com/search?q={query}', 'github.com', 6, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('Yandex', 'https://yandex.com/search/?text={query}', 'yandex.com', 7, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('360搜索', 'https://www.so.com/s?q={query}', 'www.so.com', 9, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('开发者搜索', 'https://kaifa.baidu.com/searchPage?wd={query}', 'kaifa.baidu.com', 10, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('知乎', 'https://www.zhihu.com/search?type=content&q={query}', 'www.zhihu.com', 11, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('哔哩哔哩', 'https://search.bilibili.com/all?keyword={query}', 'search.bilibili.com', 12, 0, 1);
--> statement-breakpoint
INSERT INTO `search_engines` (`name`, `url_template`, `domain`, `sort_order`, `is_default`, `enabled`) VALUES ('Tampermonkey', 'https://www.userscript.zone/search?q={query}', 'www.userscript.zone', 14, 0, 1);