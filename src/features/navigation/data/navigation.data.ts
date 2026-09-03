import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  BookmarkFoldersTable,
  BookmarksTable,
  SearchEnginesTable,
} from "@/lib/db/schema";

/**
 * ownerId 作用域过滤条件。
 * - includeLegacy=true 时额外匹配 owner_id 为 NULL 的「遗留/未归属」数据
 *   （这些旧数据视为超管账号的默认数据）。
 */
function ownerScope(
  column: SQLiteColumn,
  ownerId: string | null,
  includeLegacy: boolean,
) {
  if (ownerId === null) return isNull(column);
  return includeLegacy
    ? or(eq(column, ownerId), isNull(column))
    : eq(column, ownerId);
}

// ==================== Search Engines ====================

export async function getAllSearchEngines(
  db: DB,
  ownerId: string | null,
  includeLegacy = false,
) {
  return await db
    .select()
    .from(SearchEnginesTable)
    .where(ownerScope(SearchEnginesTable.ownerId, ownerId, includeLegacy))
    .orderBy(asc(SearchEnginesTable.sortOrder), asc(SearchEnginesTable.id));
}

export async function getEnabledSearchEngines(
  db: DB,
  ownerId: string | null,
  includeLegacy = false,
) {
  return await db
    .select()
    .from(SearchEnginesTable)
    .where(
      and(
        eq(SearchEnginesTable.enabled, true),
        ownerScope(SearchEnginesTable.ownerId, ownerId, includeLegacy),
      ),
    )
    .orderBy(asc(SearchEnginesTable.sortOrder), asc(SearchEnginesTable.id));
}

export async function findSearchEngineById(
  db: DB,
  id: number,
  ownerId: string | null,
  includeLegacy = false,
) {
  return await db.query.SearchEnginesTable.findFirst({
    where: and(
      eq(SearchEnginesTable.id, id),
      ownerScope(SearchEnginesTable.ownerId, ownerId, includeLegacy),
    ),
  });
}

export async function insertSearchEngine(
  db: DB,
  data: typeof SearchEnginesTable.$inferInsert,
) {
  const [engine] = await db.insert(SearchEnginesTable).values(data).returning();
  return engine;
}

export async function updateSearchEngine(
  db: DB,
  id: number,
  data: Partial<
    Omit<typeof SearchEnginesTable.$inferInsert, "id" | "createdAt">
  >,
  ownerId: string | null,
  includeLegacy = false,
) {
  const [engine] = await db
    .update(SearchEnginesTable)
    .set(data)
    .where(
      and(
        eq(SearchEnginesTable.id, id),
        ownerScope(SearchEnginesTable.ownerId, ownerId, includeLegacy),
      ),
    )
    .returning();
  return engine;
}

export async function deleteSearchEngine(
  db: DB,
  id: number,
  ownerId: string | null,
  includeLegacy = false,
) {
  await db
    .delete(SearchEnginesTable)
    .where(
      and(
        eq(SearchEnginesTable.id, id),
        ownerScope(SearchEnginesTable.ownerId, ownerId, includeLegacy),
      ),
    );
}

/** 取消当前默认引擎标记（限定在相同 owner 范围内，避免跨账号冲突） */
export async function clearDefaultSearchEngine(
  db: DB,
  ownerId: string | null,
  includeLegacy = false,
) {
  await db
    .update(SearchEnginesTable)
    .set({ isDefault: false })
    .where(
      and(
        eq(SearchEnginesTable.isDefault, true),
        ownerScope(SearchEnginesTable.ownerId, ownerId, includeLegacy),
      ),
    );
}

// ==================== Bookmark Folders ====================

export async function getAllFolders(
  db: DB,
  ownerId: string | null,
  includeLegacy = false,
) {
  return await db
    .select()
    .from(BookmarkFoldersTable)
    .where(ownerScope(BookmarkFoldersTable.ownerId, ownerId, includeLegacy))
    .orderBy(asc(BookmarkFoldersTable.sortOrder), asc(BookmarkFoldersTable.id));
}

export async function getFoldersWithCount(
  db: DB,
  ownerId: string | null,
  includeLegacy = false,
) {
  const ownerCond = ownerScope(BookmarkFoldersTable.ownerId, ownerId, includeLegacy);
  const bookmarkOwnerCond = ownerScope(BookmarksTable.ownerId, ownerId, includeLegacy);
  return await db
    .select({
      id: BookmarkFoldersTable.id,
      name: BookmarkFoldersTable.name,
      sortOrder: BookmarkFoldersTable.sortOrder,
      createdAt: BookmarkFoldersTable.createdAt,
      updatedAt: BookmarkFoldersTable.updatedAt,
      bookmarkCount: sql<number>`count(${BookmarksTable.id})`,
    })
    .from(BookmarkFoldersTable)
    .leftJoin(
      BookmarksTable,
      and(
        eq(BookmarksTable.folderId, BookmarkFoldersTable.id),
        bookmarkOwnerCond,
      ),
    )
    .where(ownerCond)
    .groupBy(BookmarkFoldersTable.id)
    .orderBy(asc(BookmarkFoldersTable.sortOrder), asc(BookmarkFoldersTable.id));
}

export async function findFolderById(
  db: DB,
  id: number,
  ownerId: string | null,
  includeLegacy = false,
) {
  return await db.query.BookmarkFoldersTable.findFirst({
    where: and(
      eq(BookmarkFoldersTable.id, id),
      ownerScope(BookmarkFoldersTable.ownerId, ownerId, includeLegacy),
    ),
  });
}

export async function insertFolder(
  db: DB,
  data: typeof BookmarkFoldersTable.$inferInsert,
) {
  const [folder] = await db
    .insert(BookmarkFoldersTable)
    .values(data)
    .returning();
  return folder;
}

export async function updateFolder(
  db: DB,
  id: number,
  data: Partial<
    Omit<typeof BookmarkFoldersTable.$inferInsert, "id" | "createdAt">
  >,
  ownerId: string | null,
  includeLegacy = false,
) {
  const [folder] = await db
    .update(BookmarkFoldersTable)
    .set(data)
    .where(
      and(
        eq(BookmarkFoldersTable.id, id),
        ownerScope(BookmarkFoldersTable.ownerId, ownerId, includeLegacy),
      ),
    )
    .returning();
  return folder;
}

export async function deleteFolder(
  db: DB,
  id: number,
  ownerId: string | null,
  includeLegacy = false,
) {
  // 级联删除该文件夹下的所有书签
  await db
    .delete(BookmarkFoldersTable)
    .where(
      and(
        eq(BookmarkFoldersTable.id, id),
        ownerScope(BookmarkFoldersTable.ownerId, ownerId, includeLegacy),
      ),
    );
}

// ==================== Bookmarks ====================

export async function getAllBookmarks(
  db: DB,
  ownerId: string | null,
  includeLegacy = false,
) {
  return await db
    .select()
    .from(BookmarksTable)
    .where(ownerScope(BookmarksTable.ownerId, ownerId, includeLegacy))
    .orderBy(asc(BookmarksTable.sortOrder), asc(BookmarksTable.id));
}

export async function findBookmarkById(
  db: DB,
  id: number,
  ownerId: string | null,
  includeLegacy = false,
) {
  return await db.query.BookmarksTable.findFirst({
    where: and(
      eq(BookmarksTable.id, id),
      ownerScope(BookmarksTable.ownerId, ownerId, includeLegacy),
    ),
  });
}

export async function insertBookmark(
  db: DB,
  data: typeof BookmarksTable.$inferInsert,
) {
  const [bookmark] = await db.insert(BookmarksTable).values(data).returning();
  return bookmark;
}

export async function insertBookmarksBatch(
  db: DB,
  data: Array<typeof BookmarksTable.$inferInsert>,
) {
  if (data.length === 0) return [];
  return await db.insert(BookmarksTable).values(data).returning();
}

export async function updateBookmark(
  db: DB,
  id: number,
  data: Partial<Omit<typeof BookmarksTable.$inferInsert, "id" | "createdAt">>,
  ownerId: string | null,
  includeLegacy = false,
) {
  const [bookmark] = await db
    .update(BookmarksTable)
    .set(data)
    .where(
      and(
        eq(BookmarksTable.id, id),
        ownerScope(BookmarksTable.ownerId, ownerId, includeLegacy),
      ),
    )
    .returning();
  return bookmark;
}

export async function deleteBookmark(
  db: DB,
  id: number,
  ownerId: string | null,
  includeLegacy = false,
) {
  await db
    .delete(BookmarksTable)
    .where(
      and(
        eq(BookmarksTable.id, id),
        ownerScope(BookmarksTable.ownerId, ownerId, includeLegacy),
      ),
    );
}

export async function deleteAllBookmarks(
  db: DB,
  ownerId: string | null,
  includeLegacy = false,
) {
  await db
    .delete(BookmarksTable)
    .where(ownerScope(BookmarksTable.ownerId, ownerId, includeLegacy));
}
