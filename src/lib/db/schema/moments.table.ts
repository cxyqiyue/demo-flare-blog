import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth.table";
import { createdAt, id, updatedAt } from "./helper";

export const MomentsTable = sqliteTable(
  "moments",
  {
    id,
    content: text().notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("moments_created_at_idx").on(table.createdAt),
    index("moments_user_idx").on(table.userId),
  ],
);

// ==================== types ====================
export type Moment = typeof MomentsTable.$inferSelect;
