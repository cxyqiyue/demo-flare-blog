import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt, updatedAt } from "./helper";
import { MomentsTable } from "./moments.table";

export const BlogSubscriptionsTable = sqliteTable("blog_subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt,
  updatedAt,
});

export const PostNotificationsTable = sqliteTable("post_notifications", {
  postId: integer("post_id").primaryKey(),
  contentHash: text("content_hash").notNull().default(""),
  sentAt: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const MomentNotificationsTable = sqliteTable("moment_notifications", {
  momentId: integer("moment_id")
    .primaryKey()
    .references(() => MomentsTable.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type BlogSubscription = typeof BlogSubscriptionsTable.$inferSelect;
export type PostNotification = typeof PostNotificationsTable.$inferSelect;
export type MomentNotification = typeof MomentNotificationsTable.$inferSelect;
