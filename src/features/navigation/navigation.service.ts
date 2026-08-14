import * as CacheService from "@/features/cache/cache.service";
import { err, ok } from "@/lib/errors";
import { purgeCDNCache } from "@/lib/invalidate";
import * as NavigationRepo from "./data/navigation.data";
import {
  NAVIGATION_CACHE_KEYS,
  NavigationPublicDataSchema,
  PublicNavigationDataSchema,
} from "./navigation.schema";
import type {
  CreateBookmarkInput,
  CreateFolderInput,
  CreateSearchEngineInput,
  DeleteBookmarkInput,
  DeleteFolderInput,
  DeleteSearchEngineInput,
  ImportBookmarksInput,
  SetDefaultSearchEngineInput,
  UpdateBookmarkInput,
  UpdateFolderInput,
  UpdateSearchEngineInput,
} from "./navigation.schema";

// ============ Public Methods ============

/** 公开数据：仅返回启用的搜索引擎（书签属于管理员私密数据，不在此暴露） */
export async function getNavigationPublicData(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const fetcher = async () => {
    const engines = await NavigationRepo.getEnabledSearchEngines(context.db);

    return {
      engines: engines.map((engine) => ({
        id: engine.id,
        name: engine.name,
        urlTemplate: engine.urlTemplate,
        iconUrl: engine.iconUrl,
        domain: engine.domain,
        isDefault: engine.isDefault,
        enabled: engine.enabled,
        sortOrder: engine.sortOrder,
      })),
    };
  };

  return await CacheService.getVersioned(
    context,
    "navigation:data",
    NAVIGATION_CACHE_KEYS.publicData,
    PublicNavigationDataSchema,
    fetcher,
    { ttl: "7d" },
  );
}

/** 管理数据：完整返回引擎（含未启用）、文件夹与书签，仅管理员接口可访问 */
export async function getAdminNavigationData(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const [engines, folders, bookmarks] = await Promise.all([
    NavigationRepo.getAllSearchEngines(context.db),
    NavigationRepo.getFoldersWithCount(context.db),
    NavigationRepo.getAllBookmarks(context.db),
  ]);

  return NavigationPublicDataSchema.parse({
    engines: engines.map((engine) => ({
      id: engine.id,
      name: engine.name,
      urlTemplate: engine.urlTemplate,
      iconUrl: engine.iconUrl,
      domain: engine.domain,
      isDefault: engine.isDefault,
      enabled: engine.enabled,
      sortOrder: engine.sortOrder,
    })),
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sortOrder,
      bookmarkCount: Number(folder.bookmarkCount),
    })),
    bookmarks: bookmarks.map((bookmark) => ({
      id: bookmark.id,
      folderId: bookmark.folderId,
      name: bookmark.name,
      url: bookmark.url,
      sortOrder: bookmark.sortOrder,
    })),
  });
}

// ============ Cache Invalidation ============

function invalidateCache(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  context.executionCtx.waitUntil(
    Promise.all([
      CacheService.bumpVersion(context, "navigation:data"),
      purgeCDNCache(context.env, {
        urls: ["/navigation"],
      }),
    ]),
  );
}

// ============ Admin: Search Engines ============

export async function createSearchEngine(
  context: DbContext & { executionCtx: ExecutionContext },
  data: CreateSearchEngineInput,
) {
  let isDefault = data.isDefault ?? false;
  if (isDefault) {
    await NavigationRepo.clearDefaultSearchEngine(context.db);
  } else {
    // 没有默认引擎时，首条记录自动成为默认
    const [first] = await NavigationRepo.getAllSearchEngines(context.db);
    if (!first) isDefault = true;
  }

  const engine = await NavigationRepo.insertSearchEngine(context.db, {
    name: data.name,
    urlTemplate: data.urlTemplate,
    iconUrl: data.iconUrl || null,
    domain: data.domain,
    sortOrder: data.sortOrder ?? 0,
    isDefault,
    enabled: data.enabled ?? true,
  });

  invalidateCache(context);
  return ok(engine);
}

export async function updateSearchEngine(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateSearchEngineInput,
) {
  const existing = await NavigationRepo.findSearchEngineById(context.db, data.id);
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  const { id, isDefault, ...updateData } = data;

  if (isDefault === true) {
    await NavigationRepo.clearDefaultSearchEngine(context.db);
  } else if (isDefault === false && existing.isDefault) {
    // 取消默认：如果仍需要默认引擎，则回退到第一条
    const others = (await NavigationRepo.getAllSearchEngines(context.db)).filter(
      (engine) => engine.id !== id,
    );
    if (others.length === 0) {
      // 仅此一条引擎，不能取消默认
      return err({ reason: "LAST_DEFAULT_ENGINE" });
    }
  }

  const updated = await NavigationRepo.updateSearchEngine(context.db, id, {
    ...updateData,
    isDefault: isDefault ?? existing.isDefault,
  });

  invalidateCache(context);
  return ok(updated);
}

export async function deleteSearchEngine(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteSearchEngineInput,
) {
  const existing = await NavigationRepo.findSearchEngineById(context.db, data.id);
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.deleteSearchEngine(context.db, data.id);

  // 删除默认引擎后，将剩余第一条设为默认
  const remaining = await NavigationRepo.getAllSearchEngines(context.db);
  if (remaining.length > 0) {
    const hasDefault = remaining.some((engine) => engine.isDefault);
    if (!hasDefault) {
      await NavigationRepo.updateSearchEngine(context.db, remaining[0].id, {
        isDefault: true,
      });
    }
  }

  invalidateCache(context);
  return ok({ success: true });
}

export async function setDefaultSearchEngine(
  context: DbContext & { executionCtx: ExecutionContext },
  data: SetDefaultSearchEngineInput,
) {
  const existing = await NavigationRepo.findSearchEngineById(context.db, data.id);
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.clearDefaultSearchEngine(context.db);
  const updated = await NavigationRepo.updateSearchEngine(context.db, data.id, {
    isDefault: true,
  });

  invalidateCache(context);
  return ok(updated);
}

// ============ Admin: Bookmark Folders ============

export async function createFolder(
  context: DbContext & { executionCtx: ExecutionContext },
  data: CreateFolderInput,
) {
  const folder = await NavigationRepo.insertFolder(context.db, {
    name: data.name,
    sortOrder: data.sortOrder ?? 0,
  });
  invalidateCache(context);
  return ok(folder);
}

export async function updateFolder(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateFolderInput,
) {
  const existing = await NavigationRepo.findFolderById(context.db, data.id);
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  const { id, ...updateData } = data;
  const updated = await NavigationRepo.updateFolder(context.db, id, updateData);
  invalidateCache(context);
  return ok(updated);
}

export async function deleteFolder(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteFolderInput,
) {
  const existing = await NavigationRepo.findFolderById(context.db, data.id);
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.deleteFolder(context.db, data.id);
  invalidateCache(context);
  return ok({ success: true });
}

// ============ Admin: Bookmarks ============

export async function createBookmark(
  context: DbContext & { executionCtx: ExecutionContext },
  data: CreateBookmarkInput,
) {
  const bookmark = await NavigationRepo.insertBookmark(context.db, {
    folderId: data.folderId ?? null,
    name: data.name,
    url: data.url,
    sortOrder: data.sortOrder ?? 0,
  });
  invalidateCache(context);
  return ok(bookmark);
}

export async function updateBookmark(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateBookmarkInput,
) {
  const existing = await NavigationRepo.findBookmarkById(context.db, data.id);
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  const { id, ...updateData } = data;
  const updated = await NavigationRepo.updateBookmark(context.db, id, updateData);
  invalidateCache(context);
  return ok(updated);
}

export async function deleteBookmark(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteBookmarkInput,
) {
  const existing = await NavigationRepo.findBookmarkById(context.db, data.id);
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.deleteBookmark(context.db, data.id);
  invalidateCache(context);
  return ok({ success: true });
}

// ============ Admin: Import ============

export async function importBookmarks(
  context: DbContext & { executionCtx: ExecutionContext },
  data: ImportBookmarksInput,
) {
  const { replace, items } = data;

  if (replace) {
    await NavigationRepo.deleteAllBookmarks(context.db);
    const existingFolders = await NavigationRepo.getAllFolders(context.db);
    await Promise.all(
      existingFolders.map((folder) =>
        NavigationRepo.deleteFolder(context.db, folder.id),
      ),
    );
  }

  let importCount = 0;
  for (const item of items) {
    if (item.bookmarks.length === 0) continue;

    let folderId: number | null = null;
    if (item.folderName) {
      const existingFolder = (await NavigationRepo.getAllFolders(context.db)).find(
        (folder) => folder.name === item.folderName,
      );
      const folder = existingFolder
        ? existingFolder
        : await NavigationRepo.insertFolder(context.db, {
            name: item.folderName,
            sortOrder: 0,
          });
      folderId = folder.id;
    }

    const inserted = await NavigationRepo.insertBookmarksBatch(
      context.db,
      item.bookmarks.map((bookmark, index) => ({
        folderId,
        name: bookmark.name,
        url: bookmark.url,
        sortOrder: index + 1,
      })),
    );
    importCount += inserted.length;
  }

  invalidateCache(context);
  return ok({ imported: importCount });
}
