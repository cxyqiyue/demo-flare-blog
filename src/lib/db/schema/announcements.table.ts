import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt, updatedAt } from "./helper";

export const ANNOUNCEMENT_STATUSES = ["draft", "sent"] as const;
export const ANNOUNCEMENT_DELIVERY_STATUSES = [
  "pending",
  "sent",
  "failed",
] as const;

export const AnnouncementsTable = sqliteTable(
  "announcements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    /** 发送时锁定的收件人数量（不含退订/未封禁过滤后的实际数） */
    recipientCount: integer("recipient_count").notNull().default(0),
    status: text("status", { enum: ANNOUNCEMENT_STATUSES })
      .notNull()
      .default("draft"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt,
    updatedAt,
  },
  (table) => [index("announcements_status_idx").on(table.status)],
);

export const AnnouncementDeliveriesTable = sqliteTable(
  "announcement_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => AnnouncementsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: text("status", { enum: ANNOUNCEMENT_DELIVERY_STATUSES })
      .notNull()
      .default("pending"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("announcement_deliveries_announcement_user_idx").on(
      table.announcementId,
      table.userId,
    ),
    index("announcement_deliveries_status_idx").on(table.status),
  ],
);

export const announcementsRelations = relations(AnnouncementsTable, ({ many }) => ({
  deliveries: many(AnnouncementDeliveriesTable),
}));

export const announcementDeliveriesRelations = relations(
  AnnouncementDeliveriesTable,
  ({ one }) => ({
    announcement: one(AnnouncementsTable, {
      fields: [AnnouncementDeliveriesTable.announcementId],
      references: [AnnouncementsTable.id],
      relationName: "announcementDeliveries",
    }),
  }),
);

export type Announcement = typeof AnnouncementsTable.$inferSelect;
export type AnnouncementDelivery =
  typeof AnnouncementDeliveriesTable.$inferSelect;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];
export type AnnouncementDeliveryStatus =
  (typeof ANNOUNCEMENT_DELIVERY_STATUSES)[number];