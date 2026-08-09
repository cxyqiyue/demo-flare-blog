import type { JSONContent } from "@tiptap/react";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt, id, updatedAt } from "./helper";

/**
 * 动态（Moments）：富媒体短内容。正文为 TipTap JSONContent，
 * 独立 images 字段存放图片 URL 列表。
 */
export const MomentsTable = sqliteTable(
  "moments",
  {
    id,
    content: text({ mode: "json" }).$type<JSONContent | null>(),
    images: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [index("moments_created_idx").on(table.createdAt)],
);

export const MomentLikesTable = sqliteTable(
  "moment_likes",
  {
    momentId: integer("moment_id")
      .notNull()
      .references(() => MomentsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.momentId, table.userId] }),
    index("moment_likes_moment_created_idx").on(
      table.momentId,
      table.createdAt,
    ),
  ],
);

// ==================== types ====================
export type Moment = typeof MomentsTable.$inferSelect;
export type MomentLike = typeof MomentLikesTable.$inferSelect;
