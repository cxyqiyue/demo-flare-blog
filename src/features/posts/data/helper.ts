import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import type { PostStatus } from "@/lib/db/schema";
import { PostsTable } from "@/lib/db/schema";

export type SortField = "publishedAt" | "updatedAt";
export type SortDirection = "ASC" | "DESC";

export function buildPostWhereClause(options: {
  status?: PostStatus;
  publicOnly?: boolean; // For public pages - checks publishedAt <= now
  search?: string;
  /** 公开查询默认排除受限（private/password）文章；详情壳路径显式关掉 */
  excludeRestricted?: boolean;
}) {
  const whereClauses = [];

  if (options.status) {
    whereClauses.push(eq(PostsTable.status, options.status));
  }

  // For public pages, also filter by publishedAt
  if (options.publicOnly) {
    whereClauses.push(eq(PostsTable.status, "published"));
    // Compare date portions only (ignore time-of-day) to avoid timezone issues.
    // publishedAt is stored as Unix seconds; date('now') returns today's UTC date.
    // This matches the isFuturePublishDate() string-based date comparison used in scheduling.
    whereClauses.push(
      sql`date(${PostsTable.publishedAt}, 'unixepoch') <= date('now')`,
    );
  }

  // 受限文章不进入列表/相邻/相关/RSS/sitemap 等公开聚合
  if (options.publicOnly && options.excludeRestricted !== false) {
    whereClauses.push(eq(PostsTable.visibility, "public"));
  }

  // Search by title
  if (options.search) {
    const searchTerm = options.search.trim();
    if (searchTerm) {
      whereClauses.push(like(PostsTable.title, `%${searchTerm}%`));
    }
  }

  return whereClauses.length > 0 ? and(...whereClauses) : undefined;
}

export function buildPostOrderByClause(
  sortDir?: SortDirection,
  sortBy?: SortField,
): SQL {
  const direction = sortDir ?? "DESC";
  const field = sortBy ?? "updatedAt";
  const orderFn = direction === "DESC" ? desc : asc;
  return orderFn(PostsTable[field]);
}
