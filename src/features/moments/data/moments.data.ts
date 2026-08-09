import { count, desc, eq } from "drizzle-orm";
import { MomentsTable, user } from "@/lib/db/schema";

const DEFAULT_PAGE_SIZE = 20;

export async function insertMoment(
  db: DB,
  data: typeof MomentsTable.$inferInsert,
) {
  const [moment] = await db.insert(MomentsTable).values(data).returning();
  return moment;
}

export async function findMomentById(db: DB, id: number) {
  return await db.query.MomentsTable.findFirst({
    where: eq(MomentsTable.id, id),
  });
}

export async function getMoments(
  db: DB,
  options: {
    offset?: number;
    limit?: number | null;
  } = {},
) {
  const { offset = 0, limit = DEFAULT_PAGE_SIZE } = options;

  const query = db
    .select({
      id: MomentsTable.id,
      content: MomentsTable.content,
      userId: MomentsTable.userId,
      createdAt: MomentsTable.createdAt,
      updatedAt: MomentsTable.updatedAt,
      author: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(MomentsTable)
    .leftJoin(user, eq(MomentsTable.userId, user.id))
    .orderBy(desc(MomentsTable.createdAt));

  const items =
    limit == null
      ? await query.offset(offset)
      : await query.limit(Math.min(limit, 100)).offset(offset);

  return items;
}

export async function getMomentsCount(db: DB) {
  const result = await db.select({ count: count() }).from(MomentsTable);

  return result[0].count;
}

export async function updateMoment(
  db: DB,
  id: number,
  data: Partial<Omit<typeof MomentsTable.$inferInsert, "id" | "createdAt">>,
) {
  const [moment] = await db
    .update(MomentsTable)
    .set(data)
    .where(eq(MomentsTable.id, id))
    .returning();
  return moment;
}

export async function deleteMoment(db: DB, id: number) {
  await db.delete(MomentsTable).where(eq(MomentsTable.id, id));
}
