import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  CommentsTable,
  MomentLikesTable,
  MomentsTable,
  user,
} from "@/lib/db/schema";

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

export async function getAllMoments(
  db: DB,
  options: { offset?: number; limit?: number | null } = {},
) {
  const { offset = 0, limit = 50 } = options;
  return await db
    .select({
      id: MomentsTable.id,
      content: MomentsTable.content,
      images: MomentsTable.images,
      authorUserId: MomentsTable.authorUserId,
      createdAt: MomentsTable.createdAt,
      updatedAt: MomentsTable.updatedAt,
      author: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(MomentsTable)
    .leftJoin(user, eq(MomentsTable.authorUserId, user.id))
    .orderBy(desc(MomentsTable.createdAt))
    .limit(limit == null ? 1000 : Math.min(limit, 100))
    .offset(offset);
}

export async function updateMoment(
  db: DB,
  id: number,
  data: { content: typeof MomentsTable.$inferInsert.content; images: string[] },
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

export async function countAllMoments(db: DB): Promise<number> {
  const [row] = await db.select({ total: count() }).from(MomentsTable);
  return row?.total ?? 0;
}

export async function findMomentLike(db: DB, momentId: number, userId: string) {
  return await db.query.MomentLikesTable.findFirst({
    where: and(
      eq(MomentLikesTable.momentId, momentId),
      eq(MomentLikesTable.userId, userId),
    ),
  });
}

export async function insertMomentLike(
  db: DB,
  momentId: number,
  userId: string,
) {
  await db
    .insert(MomentLikesTable)
    .values({ momentId, userId })
    .onConflictDoNothing();
}

export async function deleteMomentLike(
  db: DB,
  momentId: number,
  userId: string,
) {
  await db
    .delete(MomentLikesTable)
    .where(
      and(
        eq(MomentLikesTable.momentId, momentId),
        eq(MomentLikesTable.userId, userId),
      ),
    );
}

export async function countMomentLikesForIds(
  db: DB,
  momentIds: number[],
): Promise<Record<number, number>> {
  if (momentIds.length === 0) return {};
  const rows = await db
    .select({
      momentId: MomentLikesTable.momentId,
      count: count(),
    })
    .from(MomentLikesTable)
    .where(inArray(MomentLikesTable.momentId, momentIds))
    .groupBy(MomentLikesTable.momentId);
  return Object.fromEntries(rows.map((r) => [r.momentId, r.count]));
}

export async function getLikedMomentIdsByUser(
  db: DB,
  userId: string,
  momentIds: number[],
): Promise<number[]> {
  if (momentIds.length === 0) return [];
  const rows = await db
    .select({ momentId: MomentLikesTable.momentId })
    .from(MomentLikesTable)
    .where(
      and(
        inArray(MomentLikesTable.momentId, momentIds),
        eq(MomentLikesTable.userId, userId),
      ),
    );
  return rows.map((r) => r.momentId);
}

export async function countMomentCommentsForIds(
  db: DB,
  momentIds: number[],
): Promise<Record<number, number>> {
  if (momentIds.length === 0) return {};
  const rows = await db
    .select({
      momentId: CommentsTable.momentId,
      count: count(),
    })
    .from(CommentsTable)
    .where(
      and(
        inArray(CommentsTable.momentId, momentIds),
        eq(CommentsTable.status, "published"),
      ),
    )
    .groupBy(CommentsTable.momentId);
  return Object.fromEntries(rows.map((r) => [r.momentId, r.count]));
}

export async function getAuthorMap(
  db: DB,
  userIds: Array<string | null>,
): Promise<Record<string, { id: string; name: string; image: string | null }>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return {};
  const rows = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, ids));
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}
