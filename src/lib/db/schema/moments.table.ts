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

export const MOMENT_COMMENT_STATUSES = ["published", "deleted"] as const;

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

export const MomentCommentsTable = sqliteTable(
  "moment_comments",
  {
    id,
    momentId: integer("moment_id")
      .notNull()
      .references(() => MomentsTable.id, { onDelete: "cascade" }),
    content: text({ mode: "json" }).$type<JSONContent>(),
    status: text("status", { enum: MOMENT_COMMENT_STATUSES })
      .notNull()
      .default("published"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("moment_comments_moment_created_idx").on(
      table.momentId,
      table.createdAt,
    ),
    index("moment_comments_status_idx").on(table.status),
  ],
);

// ==================== types ====================
export type Moment = typeof MomentsTable.$inferSelect;
export type MomentLike = typeof MomentLikesTable.$inferSelect;
export type MomentComment = typeof MomentCommentsTable.$inferSelect;
export type MomentCommentStatus = (typeof MOMENT_COMMENT_STATUSES)[number];
