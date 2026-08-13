import { eq } from "drizzle-orm";
import { AboutArticleTable } from "@/lib/db/schema";

export async function findAboutArticle(db: DB) {
  const rows = await db.select().from(AboutArticleTable).limit(1);
  return rows[0] ?? null;
}

export async function insertAboutArticle(
  db: DB,
  data: { title: string; markdown: string },
) {
  const [article] = await db
    .insert(AboutArticleTable)
    .values(data)
    .returning();
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
