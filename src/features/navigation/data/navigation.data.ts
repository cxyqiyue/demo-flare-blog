import { asc, eq, sql } from "drizzle-orm";
import {
  BookmarkFoldersTable,
  BookmarksTable,
  SearchEnginesTable,
} from "@/lib/db/schema";

// ==================== Search Engines ====================

export async function getAllSearchEngines(db: DB) {
  return await db
    .select()
    .from(SearchEnginesTable)
    .orderBy(asc(SearchEnginesTable.sortOrder), asc(SearchEnginesTable.id));
}

export async function getEnabledSearchEngines(db: DB) {
  return await db
    .select()
    .from(SearchEnginesTable)
    .where(eq(SearchEnginesTable.enabled, true))
    .orderBy(asc(SearchEnginesTable.sortOrder), asc(SearchEnginesTable.id));
}

export async function findSearchEngineById(db: DB, id: number) {
  return await db.query.SearchEnginesTable.findFirst({
    where: eq(SearchEnginesTable.id, id),
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
) {
  const [engine] = await db
    .update(SearchEnginesTable)
    .set(data)
    .where(eq(SearchEnginesTable.id, id))
    .returning();
  return engine;
}

export async function deleteSearchEngine(db: DB, id: number) {
  await db.delete(SearchEnginesTable).where(eq(SearchEnginesTable.id, id));
}

/** 取消当前默认引擎标记 */
export async function clearDefaultSearchEngine(db: DB) {
  await db
    .update(SearchEnginesTable)
    .set({ isDefault: false })
    .where(eq(SearchEnginesTable.isDefault, true));
}

// ==================== Bookmark Folders ====================

export async function getAllFolders(db: DB) {
  return await db
    .select()
    .from(BookmarkFoldersTable)
    .orderBy(asc(BookmarkFoldersTable.sortOrder), asc(BookmarkFoldersTable.id));
}

export async function getFoldersWithCount(db: DB) {
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
      eq(BookmarksTable.folderId, BookmarkFoldersTable.id),
    )
    .groupBy(BookmarkFoldersTable.id)
    .orderBy(asc(BookmarkFoldersTable.sortOrder), asc(BookmarkFoldersTable.id));
}

export async function findFolderById(db: DB, id: number) {
  return await db.query.BookmarkFoldersTable.findFirst({
    where: eq(BookmarkFoldersTable.id, id),
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
) {
  const [folder] = await db
    .update(BookmarkFoldersTable)
    .set(data)
    .where(eq(BookmarkFoldersTable.id, id))
    .returning();
  return folder;
}

export async function deleteFolder(db: DB, id: number) {
  // 级联删除该文件夹下的所有书签
  await db.delete(BookmarkFoldersTable).where(eq(BookmarkFoldersTable.id, id));
}

// ==================== Bookmarks ====================

export async function getAllBookmarks(db: DB) {
  return await db
    .select()
    .from(BookmarksTable)
    .orderBy(asc(BookmarksTable.sortOrder), asc(BookmarksTable.id));
}

export async function findBookmarkById(db: DB, id: number) {
  return await db.query.BookmarksTable.findFirst({
    where: eq(BookmarksTable.id, id),
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
) {
  const [bookmark] = await db
    .update(BookmarksTable)
    .set(data)
    .where(eq(BookmarksTable.id, id))
    .returning();
  return bookmark;
}

export async function deleteBookmark(db: DB, id: number) {
  await db.delete(BookmarksTable).where(eq(BookmarksTable.id, id));
}

export async function deleteAllBookmarks(db: DB) {
  await db.delete(BookmarksTable);
}
