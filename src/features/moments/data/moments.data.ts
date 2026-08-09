import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  MomentCommentsTable,
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

export async function deleteMoment(db: DB, id: number) {
  await db.delete(MomentsTable).where(eq(MomentsTable.id, id));
}

export async function findMomentLike(db: DB, momentId: number, userId: string) {
  return await db.query.MomentLikesTable.findFirst({
    where: and(
      eq(MomentLikesTable.momentId, momentId),
      eq(MomentLikesTable.userId, userId),
    ),
  });
}

export async function insertMomentLike(db: DB, momentId: number, userId: string) {
  await db
    .insert(MomentLikesTable)
    .values({ momentId, userId })
    .onConflictDoNothing();
}

export async function deleteMomentLike(db: DB, momentId: number, userId: string) {
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

export async function getMomentCommentsForIds(
  db: DB,
  momentIds: number[],
): Promise<Record<number, Array<typeof MomentCommentsTable.$inferSelect>>> {
  if (momentIds.length === 0) return {};
  const rows = await db
    .select({
      id: MomentCommentsTable.id,
      momentId: MomentCommentsTable.momentId,
      content: MomentCommentsTable.content,
      status: MomentCommentsTable.status,
      userId: MomentCommentsTable.userId,
      createdAt: MomentCommentsTable.createdAt,
      updatedAt: MomentCommentsTable.updatedAt,
    })
    .from(MomentCommentsTable)
    .where(
      and(
        inArray(MomentCommentsTable.momentId, momentIds),
        eq(MomentCommentsTable.status, "published"),
      ),
    )
    .orderBy(desc(MomentCommentsTable.createdAt));
  const grouped: Record<number, Array<typeof MomentCommentsTable.$inferSelect>> =
    {};
  for (const row of rows) {
    (grouped[row.momentId] ??= []).push(row);
  }
  return grouped;
}

export async function insertMomentComment(
  db: DB,
  data: typeof MomentCommentsTable.$inferInsert,
) {
  const [comment] = await db
    .insert(MomentCommentsTable)
    .values(data)
    .returning();
  return comment;
}

export async function findMomentCommentById(db: DB, id: number) {
  return await db.query.MomentCommentsTable.findFirst({
    where: eq(MomentCommentsTable.id, id),
  });
}

export async function updateMomentComment(
  db: DB,
  id: number,
  data: Partial<typeof MomentCommentsTable.$inferInsert>,
) {
  await db
    .update(MomentCommentsTable)
    .set(data)
    .where(eq(MomentCommentsTable.id, id));
}

export async function countMomentCommentsForIds(
  db: DB,
  momentIds: number[],
): Promise<Record<number, number>> {
  if (momentIds.length === 0) return {};
  const rows = await db
    .select({
      momentId: MomentCommentsTable.momentId,
      count: count(),
    })
    .from(MomentCommentsTable)
    .where(
      and(
        inArray(MomentCommentsTable.momentId, momentIds),
        eq(MomentCommentsTable.status, "published"),
      ),
    )
    .groupBy(MomentCommentsTable.momentId);
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
