import { eq } from "drizzle-orm";
import { AboutArticleTable } from "@/lib/db/schema";

export async function findAboutArticle(db: DB) {
  const rows = await db.select().from(AboutArticleTable).limit(1);
  return rows[0] ?? null;
}

export async function findAboutArticleById(db: DB, id: number) {
  const rows = await db
    .select()
    .from(AboutArticleTable)
    .where(eq(AboutArticleTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertAboutArticle(
  db: DB,
  data: { title: string; markdown: string },
) {
  const [article] = await db.insert(AboutArticleTable).values(data).returning();
  return article;
}

export async function updateAboutArticle(
  db: DB,
  id: number,
  data: { title: string; markdown: string },
) {
  const [article] = await db
    .update(AboutArticleTable)
    .set(data)
    .where(eq(AboutArticleTable.id, id))
    .returning();
  return article;
}

/**
 * 更新预渲染缓存（renderedHtml + renderVersion）。
 * 在 markdown 内容不变但渲染管线变更时，仅更新渲染结果而不修改原文。
 */
export async function updateRenderedCache(
  db: DB,
  id: number,
  data: { renderedHtml: string; renderVersion: string },
) {
  await db
    .update(AboutArticleTable)
    .set(data)
    .where(eq(AboutArticleTable.id, id));
}

/**
 * 清除预渲染缓存（保存新内容后调用，下次读取时重新渲染）。
 */
export async function clearRenderedCache(db: DB, id: number) {
  await db
    .update(AboutArticleTable)
    .set({ renderedHtml: null, renderVersion: null })
    .where(eq(AboutArticleTable.id, id));
}
