import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  like,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { SortDirection, SortField } from "@/features/posts/data/helper";
import {
  buildPostOrderByClause,
  buildPostWhereClause,
} from "@/features/posts/data/helper";
import type { PostListItem } from "@/features/posts/schema/posts.schema";
import type { PostStatus, Tag } from "@/lib/db/schema";
import { PostsTable, PostTagsTable, TagsTable } from "@/lib/db/schema";

const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_SITEMAP_BATCH_SIZE = 500;

export type SitemapPostRow = {
  id: number;
  slug: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
};

export type AdjacentPostRow = {
  id: number;
  title: string;
  slug: string;
  publishedAt: Date | null;
};

export async function insertPost(db: DB, data: typeof PostsTable.$inferInsert) {
  const [post] = await db.insert(PostsTable).values(data).returning();
  return post;
}

export async function getPosts(
  db: DB,
  options: {
    offset?: number;
    limit?: number;
    status?: PostStatus;
    publicOnly?: boolean;
    search?: string;
    sortDir?: SortDirection;
    sortBy?: SortField;
  } = {},
) {
  const {
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    sortDir,
    sortBy,
    ...filters
  } = options;
  const whereClause = buildPostWhereClause(filters);
  const orderByClause = buildPostOrderByClause(sortDir, sortBy);

  const posts = await db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      summary: PostsTable.summary,
      readTimeInMinutes: PostsTable.readTimeInMinutes,
      slug: PostsTable.slug,
      status: PostsTable.status,
      visibility: PostsTable.visibility,
      passwordChannel: PostsTable.passwordChannel,
      publishedAt: PostsTable.publishedAt,
      pinnedAt: PostsTable.pinnedAt,
      skillId: PostsTable.skillId,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      publicContentRenderVersion: PostsTable.publicContentRenderVersion,
    })
    .from(PostsTable)
    .limit(Math.min(limit, 50))
    .offset(offset)
    .orderBy(orderByClause)
    .where(whereClause);
  return posts;
}

export async function getPostsCount(
  db: DB,
  options: {
    status?: PostStatus;
    publicOnly?: boolean;
    search?: string;
  } = {},
) {
  const whereClause = buildPostWhereClause(options);
  const totalNumberofPosts = await db
    .select({ count: count() })
    .from(PostsTable)
    .where(whereClause);
  return totalNumberofPosts[0].count;
}

/**
 * Get posts with cursor-based pagination
 * @param cursor - The id of the last item from previous page
 * @param limit - Number of items per page
 */
export async function getPostsCursor(
  db: DB,
  options: {
    cursor?: number;
    limit?: number;
    publicOnly?: boolean;
    tagName?: string;
    excludePinned?: boolean;
  } = {},
): Promise<{
  items: Array<PostListItem>;
  nextCursor: number | null;
}> {
  const {
    cursor,
    limit = DEFAULT_PAGE_SIZE,
    publicOnly,
    tagName,
    excludePinned,
  } = options;

  // Build base conditions from helper
  const baseConditions = buildPostWhereClause({ publicOnly });

  // Add cursor condition if provided
  const conditions = [];
  if (baseConditions) {
    conditions.push(baseConditions);
  }

  if (cursor) {
    const reference = await db.query.PostsTable.findFirst({
      where: eq(PostsTable.id, cursor),
      columns: { publishedAt: true, id: true },
    });

    if (reference?.publishedAt) {
      conditions.push(
        or(
          lt(PostsTable.publishedAt, reference.publishedAt),
          and(
            eq(PostsTable.publishedAt, reference.publishedAt),
            lt(PostsTable.id, reference.id),
          ),
        ),
      );
    } else if (reference) {
      // Fallback if somehow publishedAt is null (shouldn't happen for published posts)
      conditions.push(lt(PostsTable.id, cursor));
    }
  }

  if (tagName) {
    conditions.push(eq(TagsTable.name, tagName));
  }

  if (excludePinned) {
    conditions.push(sql`${PostsTable.pinnedAt} IS NULL`);
  }

  let query = db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      summary: PostsTable.summary,
      readTimeInMinutes: PostsTable.readTimeInMinutes,
      slug: PostsTable.slug,
      status: PostsTable.status,
      visibility: PostsTable.visibility,
      passwordChannel: PostsTable.passwordChannel,
      publishedAt: PostsTable.publishedAt,
      pinnedAt: PostsTable.pinnedAt,
      skillId: PostsTable.skillId,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      publicContentRenderVersion: PostsTable.publicContentRenderVersion,
    })
    .from(PostsTable)
    .$dynamic();

  if (tagName) {
    query = query
      .innerJoin(PostTagsTable, eq(PostsTable.id, PostTagsTable.postId))
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id));
  }

  const itemsWithPotentialNext = await query
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(PostsTable.publishedAt), desc(PostsTable.id))
    .limit(limit + 1);

  // Check if there's a next page
  const hasMore = itemsWithPotentialNext.length > limit;
  const items = itemsWithPotentialNext.slice(0, limit) as Array<PostListItem>;

  // Fetch tags for all items
  if (items.length > 0) {
    const postIds = items.map((p) => p.id);
    const tagsResults = await db
      .select({
        postId: PostTagsTable.postId,
        tag: {
          id: TagsTable.id,
          name: TagsTable.name,
          createdAt: TagsTable.createdAt,
        },
      })
      .from(PostTagsTable)
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id))
      .where(inArray(PostTagsTable.postId, postIds));

    // Map tags back to items
    const tagsByPostId = new Map<number, Array<Tag>>();
    for (const result of tagsResults) {
      const existing = tagsByPostId.get(result.postId) ?? [];
      existing.push(result.tag);
      tagsByPostId.set(result.postId, existing);
    }

    items.forEach((item) => {
      item.tags = tagsByPostId.get(item.id) ?? [];
    });
  }

  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}

export async function getPublishedPostsForSitemapBatch(
  db: DB,
  options: {
    cursor?: {
      publishedAt: Date;
      id: number;
    };
    limit?: number;
  } = {},
): Promise<Array<SitemapPostRow>> {
  const { cursor, limit = DEFAULT_SITEMAP_BATCH_SIZE } = options;

  return await db
    .select({
      id: PostsTable.id,
      slug: PostsTable.slug,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      publishedAt: PostsTable.publishedAt,
    })
    .from(PostsTable)
    .where(
      and(
        eq(PostsTable.status, "published"),
        eq(PostsTable.visibility, "public"),
        isNotNull(PostsTable.publishedAt),
        sql`date(${PostsTable.publishedAt}, 'unixepoch') <= date('now')`,
        cursor
          ? or(
              lt(PostsTable.publishedAt, cursor.publishedAt),
              and(
                eq(PostsTable.publishedAt, cursor.publishedAt),
                lt(PostsTable.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(PostsTable.publishedAt), desc(PostsTable.id))
    .limit(limit);
}

export async function findPostById(db: DB, id: number) {
  const post = await db.query.PostsTable.findFirst({
    where: eq(PostsTable.id, id),
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!post) return null;

  // Flatten tags
  const tags = post.postTags.map((pt) => pt.tag);
  const { postTags, ...rest } = post;
  return { ...rest, tags };
}

export async function findPostsByIds(db: DB, ids: Array<number>) {
  if (ids.length === 0) return [];

  return await db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      slug: PostsTable.slug,
      status: PostsTable.status,
      publishedAt: PostsTable.publishedAt,
    })
    .from(PostsTable)
    .where(inArray(PostsTable.id, ids));
}

export async function findPostsBySlugs(db: DB, slugs: string[]) {
  if (slugs.length === 0) return [];

  const posts = await db.query.PostsTable.findMany({
    where: and(
      buildPostWhereClause({ publicOnly: true }),
      inArray(PostsTable.slug, slugs),
    ),
    columns: {
      id: true,
      title: true,
      summary: true,
      readTimeInMinutes: true,
      slug: true,
      status: true,
      visibility: true,
      passwordChannel: true,
      publishedAt: true,
      pinnedAt: true,
      skillId: true,
      createdAt: true,
      updatedAt: true,
      publicContentRenderVersion: true,
    },
    with: {
      postTags: {
        with: { tag: true },
      },
    },
  });

  return posts.map((p) => ({
    ...p,
    tags: p.postTags.map((pt) => pt.tag),
  }));
}

export async function findPostBySlug(
  db: DB,
  slug: string,
  options: { publicOnly?: boolean; excludeRestricted?: boolean } = {},
) {
  const { publicOnly = false, excludeRestricted = true } = options;

  const whereClause = buildPostWhereClause({
    publicOnly,
    excludeRestricted,
  });
  const post = await db.query.PostsTable.findFirst({
    where: and(eq(PostsTable.slug, slug), whereClause),
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!post) return null;

  // Flatten tags
  const tags = post.postTags.map((pt) => pt.tag);
  const { postTags, ...rest } = post;
  return { ...rest, tags };
}

/**
 * 轻量门禁预检：只取鉴权所需 + 壳渲染所需字段（不取 contentJson，
 * 避免公开详情热路径多拉正文大字段）。仅命中已发布的文章。
 */
export async function findPostGateBySlug(db: DB, slug: string) {
  const whereClause = buildPostWhereClause({
    publicOnly: true,
    excludeRestricted: false,
  });
  const post = await db.query.PostsTable.findFirst({
    where: and(eq(PostsTable.slug, slug), whereClause),
    columns: {
      id: true,
      slug: true,
      status: true,
      visibility: true,
      passwordHash: true,
      passwordChannel: true,
      title: true,
      summary: true,
      readTimeInMinutes: true,
      publishedAt: true,
      pinnedAt: true,
      createdAt: true,
      updatedAt: true,
      skillId: true,
      publicContentRenderVersion: true,
    },
  });
  return post ?? null;
}

export async function updatePost(
  db: DB,
  id: number,
  data: Partial<Omit<typeof PostsTable.$inferInsert, "id" | "createdAt">>,
) {
  await db.update(PostsTable).set(data).where(eq(PostsTable.id, id));
  return await findPostById(db, id);
}

/**
 * Batch-update the status of multiple posts.
 * - `publishedAt` is kept unchanged for already-published posts; posts without
 *   one get a single shared timestamp so their relative order is preserved.
 * - `updatedAt` is explicitly kept unchanged so admin list ordering (default
 *   sort: updatedAt DESC) is not disturbed by a batch operation.
 */
export async function batchUpdatePostsStatus(
  db: DB,
  ids: Array<number>,
  status: PostStatus,
) {
  if (ids.length === 0) return;

  if (status === "published") {
    // publishedAt is stored as a unix-timestamp integer (seconds); the D1
    // driver rejects Date objects inside raw SQL templates, so bind seconds.
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(PostsTable)
      .set({
        status,
        publishedAt: sql`COALESCE(${PostsTable.publishedAt}, ${now})`,
        updatedAt: sql`${PostsTable.updatedAt}`,
      })
      .where(inArray(PostsTable.id, ids));
  } else {
    await db
      .update(PostsTable)
      .set({
        status,
        publishedAt: sql`${PostsTable.publishedAt}`,
        updatedAt: sql`${PostsTable.updatedAt}`,
      })
      .where(inArray(PostsTable.id, ids));
  }
}

export async function touchPostUpdatedAt(db: DB, id: number) {
  await db
    .update(PostsTable)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(PostsTable.id, id));
}

export async function updatePublicContentSnapshot(
  db: DB,
  id: number,
  publicContentJson: typeof PostsTable.$inferInsert.publicContentJson,
  renderVersion?: string,
) {
  await db
    .update(PostsTable)
    .set({
      publicContentJson,
      ...(renderVersion !== undefined
        ? { publicContentRenderVersion: renderVersion }
        : {}),
      // Snapshot rebuilds should not affect editorial ordering/history.
      updatedAt: sql`${PostsTable.updatedAt}`,
    })
    .where(eq(PostsTable.id, id));
  return await findPostById(db, id);
}

export async function deletePost(db: DB, id: number) {
  await db.delete(PostsTable).where(eq(PostsTable.id, id));
}

/**
 * Check if a slug exists in the database
 * @param slug - The slug to check
 * @param excludeId - Optional post ID to exclude (for editing existing posts)
 */
export async function slugExists(
  db: DB,
  slug: string,
  options: { excludeId?: number } = {},
): Promise<boolean> {
  const { excludeId } = options;
  const conditions = [eq(PostsTable.slug, slug)];
  if (excludeId) {
    conditions.push(ne(PostsTable.id, excludeId));
  }
  const results = await db
    .select({ id: PostsTable.id })
    .from(PostsTable)
    .where(and(...conditions))
    .limit(1);
  return results.length > 0;
}

/**
 * 找出所有长得像 "baseSlug-%" 的 Slug
 */
export async function findSimilarSlugs(
  db: DB,
  baseSlug: string,
  options: { excludeId?: number } = {},
) {
  const conditions = [like(PostsTable.slug, `${baseSlug}-%`)];

  // 如果是编辑文章，要排除掉自己，防止把自己算作冲突
  if (options.excludeId) {
    conditions.push(ne(PostsTable.id, options.excludeId));
  }

  const results = await db
    .select({ slug: PostsTable.slug })
    .from(PostsTable)
    .where(and(...conditions));

  return results.map((r) => r.slug);
}

export async function getRelatedPostIds(
  db: DB,
  slug: string,
  options: { limit?: number } = {},
) {
  const { limit = 3 } = options;

  // 1. Get current post ID and its tags
  const currentPost = await db.query.PostsTable.findFirst({
    where: eq(PostsTable.slug, slug),
    with: {
      postTags: true,
    },
    columns: { id: true },
  });

  if (!currentPost || currentPost.postTags.length === 0) {
    return [];
  }

  const tagIds = currentPost.postTags.map((pt) => pt.tagId);

  // 2. Find posts that share at least one tag
  // Return only IDs, ordered by match count
  const matchingPosts = await db
    .select({
      id: PostsTable.id,
      matchCount: sql<number>`count(${PostTagsTable.tagId})`.as("match_count"),
    })
    .from(PostsTable)
    .innerJoin(PostTagsTable, eq(PostsTable.id, PostTagsTable.postId))
    .where(
      and(
        ne(PostsTable.id, currentPost.id),
        eq(PostsTable.status, "published"),
        inArray(PostTagsTable.tagId, tagIds),
      ),
    )
    .groupBy(PostsTable.id)
    .orderBy(desc(sql`match_count`), desc(PostsTable.publishedAt))
    .limit(limit);

  return matchingPosts.map((p) => p.id);
}

export async function getPublicPostsByIds(db: DB, ids: Array<number>) {
  if (ids.length === 0) return [];

  const whereClause = buildPostWhereClause({ publicOnly: true });

  const posts = await db
    .select({
      id: PostsTable.id,
      title: PostsTable.title,
      summary: PostsTable.summary,
      readTimeInMinutes: PostsTable.readTimeInMinutes,
      slug: PostsTable.slug,
      status: PostsTable.status,
      visibility: PostsTable.visibility,
      passwordChannel: PostsTable.passwordChannel,
      publishedAt: PostsTable.publishedAt,
      pinnedAt: PostsTable.pinnedAt,
      skillId: PostsTable.skillId,
      createdAt: PostsTable.createdAt,
      updatedAt: PostsTable.updatedAt,
      publicContentRenderVersion: PostsTable.publicContentRenderVersion,
    })
    .from(PostsTable)
    .where(and(inArray(PostsTable.id, ids), whereClause));

  return posts;
}

const PUBLIC_PAGE_COLUMNS = {
  id: PostsTable.id,
  title: PostsTable.title,
  summary: PostsTable.summary,
  readTimeInMinutes: PostsTable.readTimeInMinutes,
  slug: PostsTable.slug,
  status: PostsTable.status,
  visibility: PostsTable.visibility,
  passwordChannel: PostsTable.passwordChannel,
  publishedAt: PostsTable.publishedAt,
  pinnedAt: PostsTable.pinnedAt,
  skillId: PostsTable.skillId,
  createdAt: PostsTable.createdAt,
  updatedAt: PostsTable.updatedAt,
  publicContentRenderVersion: PostsTable.publicContentRenderVersion,
} as const;

/**
 * Offset-based pagination for public posts (home page).
 * Pinned posts are shown once at the very top of the first page and are
 * excluded from the regular timestamp-ordered list, so they never occupy a
 * slot and push later posts down. Pagination only applies to regular posts.
 */
export async function getPublicPostsPage(
  db: DB,
  options: { offset?: number; limit?: number } = {},
): Promise<{
  items: Array<PostListItem>;
  total: number;
  regularCount: number;
}> {
  const offset = options.offset ?? 0;
  const limit = Math.min(options.limit ?? 10, 50);

  const publicWhereClause = buildPostWhereClause({ publicOnly: true });
  const regularWhereClause = and(
    publicWhereClause,
    sql`${PostsTable.pinnedAt} IS NULL`,
  );

  const [regularPosts, totalRows] = await Promise.all([
    db
      .select(PUBLIC_PAGE_COLUMNS)
      .from(PostsTable)
      .where(regularWhereClause)
      .orderBy(desc(PostsTable.publishedAt), desc(PostsTable.id))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(PostsTable).where(regularWhereClause),
  ]);

  const total = totalRows[0]?.count ?? 0;

  const items = [] as Array<PostListItem>;

  // Pinned posts are prepended to the first page only; they are excluded from
  // the regular list above so they don't occupy a timestamp slot.
  if (offset === 0) {
    const pinnedPosts = await db
      .select(PUBLIC_PAGE_COLUMNS)
      .from(PostsTable)
      .where(and(publicWhereClause, isNotNull(PostsTable.pinnedAt)))
      .orderBy(desc(PostsTable.pinnedAt));
    items.push(...pinnedPosts);
  }

  items.push(...regularPosts);

  if (items.length > 0) {
    const postIds = items.map((p) => p.id);
    const tagsResults = await db
      .select({
        postId: PostTagsTable.postId,
        tag: {
          id: TagsTable.id,
          name: TagsTable.name,
          createdAt: TagsTable.createdAt,
        },
      })
      .from(PostTagsTable)
      .innerJoin(TagsTable, eq(PostTagsTable.tagId, TagsTable.id))
      .where(inArray(PostTagsTable.postId, postIds));

    const tagsByPostId = new Map<number, Array<Tag>>();
    for (const result of tagsResults) {
      const existing = tagsByPostId.get(result.postId) ?? [];
      existing.push(result.tag);
      tagsByPostId.set(result.postId, existing);
    }

    items.forEach((item) => {
      item.tags = tagsByPostId.get(item.id) ?? [];
    });
  }

  return { items, total, regularCount: regularPosts.length };
}

/**
 * Find the immediately previous and next published posts relative to a post,
 * ordered by (publishedAt DESC, id DESC) which matches public list ordering.
 */
export async function findAdjacentPosts(
  db: DB,
  slug: string,
): Promise<{
  previous: AdjacentPostRow | null;
  next: AdjacentPostRow | null;
}> {
  const current = await db.query.PostsTable.findFirst({
    where: eq(PostsTable.slug, slug),
    columns: { id: true, publishedAt: true },
  });

  if (!current?.publishedAt) {
    return { previous: null, next: null };
  }

  const currentPublishedAt = current.publishedAt;
  const currentId = current.id;
  const baseConditions = buildPostWhereClause({ publicOnly: true });

  const adjacentQuery = (pinnedDir: "prev" | "next") => {
    const bounds =
      pinnedDir === "prev"
        ? or(
            lt(PostsTable.publishedAt, currentPublishedAt),
            and(
              eq(PostsTable.publishedAt, currentPublishedAt),
              lt(PostsTable.id, currentId),
            ),
          )
        : or(
            gt(PostsTable.publishedAt, currentPublishedAt),
            and(
              eq(PostsTable.publishedAt, currentPublishedAt),
              gt(PostsTable.id, currentId),
            ),
          );

    const order =
      pinnedDir === "prev"
        ? [desc(PostsTable.publishedAt), desc(PostsTable.id)]
        : [asc(PostsTable.publishedAt), asc(PostsTable.id)];

    return db
      .select({
        id: PostsTable.id,
        title: PostsTable.title,
        slug: PostsTable.slug,
        publishedAt: PostsTable.publishedAt,
      })
      .from(PostsTable)
      .where(and(baseConditions, bounds))
      .orderBy(...order)
      .limit(1);
  };

  const [previous, next] = await Promise.all([
    adjacentQuery("prev").then((rows) => rows[0] ?? null),
    adjacentQuery("next").then((rows) => rows[0] ?? null),
  ]);

  // Exclude the current post itself from either side (safety for same-id edge case)
  const isCurrent = (row: AdjacentPostRow | null) =>
    row !== null && row.id === current.id;

  return {
    previous: isCurrent(previous) ? null : previous,
    next: isCurrent(next) ? null : next,
  };
}

/**
 * Fetch full post data (including tags and content) for export or other detailed use cases.
 * Uses Drizzle relational queries for efficiency.
 */
export async function findFullPosts(
  db: DB,
  options: {
    ids?: Array<number>;
    status?: PostStatus;
  } = {},
) {
  const { ids, status } = options;
  const conditions = [];

  if (ids && ids.length > 0) {
    conditions.push(inArray(PostsTable.id, ids));
  }
  if (status) {
    conditions.push(eq(PostsTable.status, status));
  }

  const results = await db.query.PostsTable.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
    orderBy: [desc(PostsTable.createdAt)],
  });

  return results.map((post) => {
    const { postTags, ...rest } = post;
    return {
      ...rest,
      tags: postTags.map((pt) => pt.tag),
    };
  });
}
