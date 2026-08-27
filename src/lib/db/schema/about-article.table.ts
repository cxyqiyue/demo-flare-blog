import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";

/**
 * 关于页面独立文章。
 * 与 posts 完全解耦：全站仅允许一篇，内容以 Markdown 存储，
 * 由关于页自己的 Markdown 编辑器维护。
 *
 * renderedHtml / renderVersion 用于缓存服务端 Shiki 预渲染结果，
 * 当渲染管线变更时递增 renderVersion 即可触发懒加载重新渲染。
 */
export const AboutArticleTable = sqliteTable("about_article", {
  id,
  title: text().notNull(),
  markdown: text().notNull(),
  /** 服务端预渲染的 HTML（含 Shiki 代码高亮），由 getAboutArticle 懒加载填充 */
  renderedHtml: text("rendered_html"),
  /** 渲染版本号，与 ABOUT_RENDER_VERSION 对比决定是否需要重新渲染 */
  renderVersion: text("render_version"),
  createdAt,
  updatedAt,
});

// ==================== types ====================
export type AboutArticle = typeof AboutArticleTable.$inferSelect;
