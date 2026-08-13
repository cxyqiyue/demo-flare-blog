import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";

/**
 * 关于页面独立文章。
 * 与 posts 完全解耦：全站仅允许一篇，内容以 Markdown 存储，
 * 由关于页自己的 Markdown 编辑器维护。
 */
export const AboutArticleTable = sqliteTable("about_article", {
  id,
  title: text().notNull(),
  markdown: text().notNull(),
  createdAt,
  updatedAt,
});

// ==================== types ====================
export type AboutArticle = typeof AboutArticleTable.$inferSelect;
