import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt, updatedAt } from "./helper";

export const BlogSubscriptionsTable = sqliteTable("blog_subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt,
  updatedAt,
});

export const PostNotificationsTable = sqliteTable("post_notifications", {
  postId: integer("post_id").primaryKey(),
  sentAt: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type BlogSubscription = typeof BlogSubscriptionsTable.$inferSelect;
export type PostNotification = typeof PostNotificationsTable.$inferSelect;
