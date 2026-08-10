import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";
import { PostsTable } from "./posts.table";

export const SkillsTable = sqliteTable("skills", {
  id,
  name: text().notNull().unique(),
  description: text(),
  createdAt,
  updatedAt,
});

// ==================== relations ====================
export const skillsRelations = relations(SkillsTable, ({ many }) => ({
  posts: many(PostsTable),
}));

// ==================== types ====================
export type Skill = typeof SkillsTable.$inferSelect;
