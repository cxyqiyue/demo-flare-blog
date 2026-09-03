import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt, id, updatedAt } from "./helper";

/**
 * 导航页 — 搜索引擎
 * urlTemplate 中 `{query}` 会被替换为 URL 编码后的搜索词。
 * 默认引擎（isDefault=1）在导航页首次加载时被预选中。
 */
export const SearchEnginesTable = sqliteTable(
  "search_engines",
  {
    id,
    name: text("name").notNull(),
    urlTemplate: text("url_template").notNull(),
    iconUrl: text("icon_url"),
    domain: text("domain").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("search_engines_owner_idx").on(table.ownerId),
    index("search_engines_order_idx").on(table.sortOrder),
    uniqueIndex("search_engines_default_unique")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = 1`),
  ],
);

/**
 * 导航页 — 书签文件夹
 */
export const BookmarkFoldersTable = sqliteTable(
  "bookmark_folders",
  {
    id,
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt,
    updatedAt,
  },
  (table) => [index("bookmark_folders_owner_idx").on(table.ownerId), index("bookmark_folders_order_idx").on(table.sortOrder)],
);

/**
 * 导航页 — 书签
 * folderId 为空表示未分类书签。
 */
export const BookmarksTable = sqliteTable(
  "bookmarks",
  {
    id,
    folderId: integer("folder_id").references(() => BookmarkFoldersTable.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("bookmarks_owner_idx").on(table.ownerId),
    index("bookmarks_folder_order_idx").on(table.folderId, table.sortOrder),
    index("bookmarks_folder_id_idx").on(table.folderId),
  ],
);

// ==================== types ====================
export type SearchEngine = typeof SearchEnginesTable.$inferSelect;
export type BookmarkFolder = typeof BookmarkFoldersTable.$inferSelect;
export type Bookmark = typeof BookmarksTable.$inferSelect;
