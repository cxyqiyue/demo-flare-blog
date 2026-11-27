import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  CommentsTable,
  PageViewsTable,
  PostsTable,
  user as UserTable,
} from "@/lib/db/schema";

function postAuthorScope(authorId?: string) {
  return authorId === undefined ? undefined : eq(PostsTable.authorId, authorId);
}

function commentAuthorScope(authorId?: string) {
  return authorId === undefined
    ? undefined
    : or(isNull(CommentsTable.postId), eq(PostsTable.authorId, authorId));
}

export async function getPendingCommentsCount(db: DB, authorId?: string) {
  const [result] = await db
    .select({ count: count() })
    .from(CommentsTable)
    .leftJoin(PostsTable, eq(CommentsTable.postId, PostsTable.id))
    .where(
      and(eq(CommentsTable.status, "pending"), commentAuthorScope(authorId)),
    );
  return result.count;
}

export async function getPublishedPostsCount(db: DB, authorId?: string) {
  const [result] = await db
    .select({ count: count() })
    .from(PostsTable)
    .where(and(eq(PostsTable.status, "published"), postAuthorScope(authorId)));
  return result.count;
}

export async function getDraftsCount(db: DB, authorId?: string) {
  const [result] = await db
    .select({ count: count() })
    .from(PostsTable)
    .where(and(eq(PostsTable.status, "draft"), postAuthorScope(authorId)));
  return result.count;
}

export async function getRecentComments(db: DB, limit = 5, authorId?: string) {
  return db
    .select()
    .from(CommentsTable)
    .leftJoin(UserTable, eq(CommentsTable.userId, UserTable.id))
    .leftJoin(PostsTable, eq(CommentsTable.postId, PostsTable.id))
    .where(commentAuthorScope(authorId))
    .orderBy(desc(CommentsTable.createdAt))
    .limit(limit);
}

export async function getRecentPosts(db: DB, limit = 5, authorId?: string) {
  return db
    .select()
    .from(PostsTable)
    .where(and(eq(PostsTable.status, "published"), postAuthorScope(authorId)))
    .orderBy(desc(PostsTable.publishedAt))
    .limit(limit);
}

export async function getRecentUsers(db: DB, limit = 5) {
  return db
    .select()
    .from(UserTable)
    .orderBy(desc(UserTable.createdAt))
    .limit(limit);
}

export async function getTrafficStats(
  db: DB,
  startAt: Date,
  endAt: Date,
  authorId?: string,
) {
  const [result] = await db
    .select({ pv: count(), uv: countDistinct(PageViewsTable.visitorHash) })
    .from(PageViewsTable)
    .innerJoin(PostsTable, eq(PageViewsTable.postId, PostsTable.id))
    .where(
      and(
        gte(PageViewsTable.createdAt, startAt),
        lt(PageViewsTable.createdAt, endAt),
        postAuthorScope(authorId),
      ),
    );
  return { pv: result?.pv ?? 0, uv: result?.uv ?? 0 };
}

export async function getTrafficTrend(
  db: DB,
  startAt: Date,
  endAt: Date,
  unit: "hour" | "day",
  authorId?: string,
) {
  const bucket =
    unit === "hour"
      ? sql<number>`(${PageViewsTable.createdAt} - ${PageViewsTable.createdAt} % 3600)`
      : sql<number>`(${PageViewsTable.createdAt} - ${PageViewsTable.createdAt} % 86400)`;
  const rows = await db
    .select({ bucket: bucket.as("bucket"), views: count() })
    .from(PageViewsTable)
    .innerJoin(PostsTable, eq(PageViewsTable.postId, PostsTable.id))
    .where(
      and(
        gte(PageViewsTable.createdAt, startAt),
        lt(PageViewsTable.createdAt, endAt),
        postAuthorScope(authorId),
      ),
    )
    .groupBy(sql`bucket`)
    .orderBy(sql`bucket`);
  return rows.map((row) => ({
    date: Number(row.bucket) * 1000,
    views: row.views,
  }));
}

export async function getTopPages(
  db: DB,
  startAt: Date,
  endAt: Date,
  limit = 5,
  authorId?: string,
) {
  return db
    .select({
      slug: PostsTable.slug,
      title: PostsTable.title,
      views: count().as("views"),
    })
    .from(PageViewsTable)
    .innerJoin(PostsTable, eq(PageViewsTable.postId, PostsTable.id))
    .where(
      and(
        gte(PageViewsTable.createdAt, startAt),
        lt(PageViewsTable.createdAt, endAt),
        postAuthorScope(authorId),
      ),
    )
    .groupBy(PostsTable.slug)
    .orderBy(sql`views DESC`)
    .limit(limit);
}
