import * as CacheService from "@/features/cache/cache.service";
import * as EdgeCacheService from "@/features/cache/edge-cache.service";
import { isSuperAdmin } from "@/lib/auth/access";
import { eq } from "drizzle-orm";
import { err, ok } from "@/lib/errors";
import { serverEnv } from "@/lib/env/server.env";
import { purgeCDNCache } from "@/lib/invalidate";
import { user } from "@/lib/db/schema";
import * as NavigationRepo from "./data/navigation.data";
import type {
  CreateBookmarkInput,
  CreateFolderInput,
  CreateSearchEngineInput,
  DeleteBookmarkInput,
  DeleteBookmarksInput,
  DeleteFolderInput,
  DeleteFoldersInput,
  DeleteSearchEngineInput,
  ImportBookmarksInput,
  SetDefaultSearchEngineInput,
  UpdateBookmarkInput,
  UpdateFolderInput,
  UpdateSearchEngineInput,
} from "./navigation.schema";
import {
  NAVIGATION_CACHE_KEYS,
  NavigationPublicDataSchema,
  PublicNavigationDataSchema,
} from "./navigation.schema";

/**
 * 解析当前操作的目标 owner 作用域。
 * - 普通管理员：始终限定在自己的 user.id（includeLegacy=false）。
 * - 超级管理员：默认管理自己账号（含遗留 NULL 数据）；可传入 targetOwnerId
 *   查看/编辑任意管理员账号（此时不包含遗留数据，遗留数据归属超管本人）。
 */
function resolveOwnerScope(
  actor: { id: string; email: string },
  env: Env,
  targetOwnerId?: string | null,
): { ownerId: string; includeLegacy: boolean } {
  const actorIsSuper = isSuperAdmin(actor, env);
  const ownerId = targetOwnerId ?? actor.id;
  const includeLegacy = actorIsSuper && ownerId === actor.id;
  return { ownerId, includeLegacy };
}

/** 访客视图中解析目标的 owner 作用域（非管理员 → 超管账号）。 */
async function resolvePublicOwnerScope(
  context: DbContext,
): Promise<{ ownerId: string | null; includeLegacy: boolean }> {
  const superAdminEmail = serverEnv(context.env).ADMIN_EMAIL.trim().toLowerCase();
  const superAdminUser = await context.db.query.user.findFirst({
    where: eq(user.email, superAdminEmail),
  });
  if (superAdminUser) {
    return { ownerId: superAdminUser.id, includeLegacy: true };
  }
  // 未找到超管账号：回退到仅遗留（owner 为 NULL）数据
  return { ownerId: null, includeLegacy: true };
}

/**
 * 列出可作为导航「owner」的账号（用于超管后台的账号选择器）：
 * 所有普通管理员（role=admin）以及超级管理员（ADMIN_EMAIL 持有者）。
 */
export async function getNavigationOwnerAccounts(context: AdminContext) {
  const superAdminEmail = serverEnv(context.env).ADMIN_EMAIL.trim().toLowerCase();
  const admins = await context.db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.role, "admin"));

  const accounts = new Map<string, { id: string; name: string; email: string }>();
  for (const a of admins) {
    accounts.set(a.id, { id: a.id, name: a.name, email: a.email });
  }
  const superAdminUser = await context.db.query.user.findFirst({
    where: eq(user.email, superAdminEmail),
  });
  if (superAdminUser) {
    accounts.set(superAdminUser.id, {
      id: superAdminUser.id,
      name: superAdminUser.name,
      email: superAdminUser.email,
    });
  }
  return Array.from(accounts.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/**
 * 管理员账号「首次登录」时初始化其导航管理的搜索引擎：
 * - 将超级管理员当前生效的全部搜索引擎（自身 + 遗留 NULL 数据）复制给该管理员，
 *   使其中导航管理面板看到的默认引擎与超管一致，后续可独立个性化设置。
 * - 书签/文件夹保持为空（不复制，属管理员私密数据，需自行创建/导入）。
 * - 非管理员、超管本人、或已有自有引擎的管理员均跳过，幂等。
 */
export async function seedAdminNavigationOnFirstLogin(
  context: DbContext,
  targetUserId: string,
): Promise<void> {
  try {
    const [targetUser] = await context.db
      .select({ id: user.id, email: user.email, role: user.role })
      .from(user)
      .where(eq(user.id, targetUserId))
      .limit(1);
    if (!targetUser) return;

    // 仅普通管理员需要初始化；超管本身可见遗留默认引擎，无需复制
    if (targetUser.role !== "admin") return;
    if (isSuperAdmin(targetUser, context.env)) return;

    // 已有自有引擎 → 已初始化过，跳过（幂等）
    const existing = await NavigationRepo.getAllSearchEngines(
      context.db,
      targetUserId,
      false,
    );
    if (existing.length > 0) return;

    // 复制来源：超管当前生效的全部引擎（自身 owner + 遗留 NULL）
    const superAdminEmail = serverEnv(context.env).ADMIN_EMAIL.trim().toLowerCase();
    const superAdminUser = await context.db.query.user.findFirst({
      where: eq(user.email, superAdminEmail),
    });
    if (!superAdminUser) return;

    const source = await NavigationRepo.getAllSearchEngines(
      context.db,
      superAdminUser.id,
      true,
    );
    if (source.length === 0) return;

    await NavigationRepo.insertSearchEnginesBatch(
      context.db,
      source.map((engine) => ({
        name: engine.name,
        urlTemplate: engine.urlTemplate,
        iconUrl: engine.iconUrl,
        domain: engine.domain,
        sortOrder: engine.sortOrder,
        // 全局唯一索引仅允许一条 is_default=1（归属超管/遗留）；复制的管理员副本不设默认，
        // 默认引擎仍由超管集合提供，功能一致，后续管理员可在自己集合内自行设置
        isDefault: false,
        enabled: engine.enabled,
        ownerId: targetUserId,
      })),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "seedAdminNavigationOnFirstLogin failed",
        targetUserId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

// ============ Public Methods ============

/**
 * 公开数据：仅返回启用的搜索引擎（书签属于管理员私密数据，不在此暴露）。
 * 数据来源按「当前访客」切换：非管理员 → 超管账号的引擎；管理员/超管 → 本人账号的引擎。
 * 缓存键按 owner 区分，避免不同账号数据串扰。
 */
export async function getNavigationPublicData(
  context: DbContext & { executionCtx: ExecutionContext } & {
    viewerOwner?: { ownerId: string | null; includeLegacy: boolean };
  },
) {
  const owner =
    context.viewerOwner ??
    (await resolvePublicOwnerScope(context));

  const ownerKey = owner.ownerId ?? "legacy";

  const fetcher = async () => {
    const engines = await NavigationRepo.getEnabledSearchEngines(
      context.db,
      owner.ownerId,
      owner.includeLegacy,
    );

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

  // 公开导航数据改存 Cache API（零 KV 配额），版本指针仍走 KV 保留失效语义
  return await EdgeCacheService.getVersionedJson(
    context,
    "navigation:data",
    (version) => NAVIGATION_CACHE_KEYS.publicData(version, ownerKey),
    PublicNavigationDataSchema,
    fetcher,
    { ttl: "7d" },
  );
}

/** 管理数据：完整返回引擎（含未启用）、文件夹与书签，仅管理员接口可访问 */
export async function getAdminNavigationData(
  context: AdminContext & { executionCtx: ExecutionContext },
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );

  const [engines, folders, bookmarks] = await Promise.all([
    NavigationRepo.getAllSearchEngines(context.db, ownerId, includeLegacy),
    NavigationRepo.getFoldersWithCount(context.db, ownerId, includeLegacy),
    NavigationRepo.getAllBookmarks(context.db, ownerId, includeLegacy),
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
  context: AdminContext & { executionCtx: ExecutionContext },
  data: CreateSearchEngineInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );

  let isDefault = data.isDefault ?? false;
  if (isDefault) {
    await NavigationRepo.clearDefaultSearchEngine(
      context.db,
      ownerId,
      includeLegacy,
    );
  } else {
    // 没有默认引擎时，首条记录自动成为默认
    const [first] = await NavigationRepo.getAllSearchEngines(
      context.db,
      ownerId,
      includeLegacy,
    );
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
    ownerId,
  });

  invalidateCache(context);
  return ok(engine);
}

export async function updateSearchEngine(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: UpdateSearchEngineInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );

  const existing = await NavigationRepo.findSearchEngineById(
    context.db,
    data.id,
    ownerId,
    includeLegacy,
  );
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  const { id, isDefault, ...updateData } = data;

  if (isDefault === true) {
    await NavigationRepo.clearDefaultSearchEngine(
      context.db,
      ownerId,
      includeLegacy,
    );
  } else if (isDefault === false && existing.isDefault) {
    // 取消默认：如果仍需要默认引擎，则回退到第一条
    const others = (
      await NavigationRepo.getAllSearchEngines(context.db, ownerId, includeLegacy)
    ).filter((engine) => engine.id !== id);
    if (others.length === 0) {
      // 仅此一条引擎，不能取消默认
      return err({ reason: "LAST_DEFAULT_ENGINE" });
    }
  }

  const updated = await NavigationRepo.updateSearchEngine(
    context.db,
    id,
    { ...updateData, isDefault: isDefault ?? existing.isDefault },
    ownerId,
    includeLegacy,
  );

  invalidateCache(context);
  return ok(updated);
}

export async function deleteSearchEngine(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: DeleteSearchEngineInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );

  const existing = await NavigationRepo.findSearchEngineById(
    context.db,
    data.id,
    ownerId,
    includeLegacy,
  );
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.deleteSearchEngine(context.db, data.id, ownerId, includeLegacy);

  // 删除默认引擎后，将剩余第一条设为默认
  const remaining = await NavigationRepo.getAllSearchEngines(
    context.db,
    ownerId,
    includeLegacy,
  );
  if (remaining.length > 0) {
    const hasDefault = remaining.some((engine) => engine.isDefault);
    if (!hasDefault) {
      await NavigationRepo.updateSearchEngine(
        context.db,
        remaining[0].id,
        { isDefault: true },
        ownerId,
        includeLegacy,
      );
    }
  }

  invalidateCache(context);
  return ok({ success: true });
}

export async function setDefaultSearchEngine(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: SetDefaultSearchEngineInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );

  const existing = await NavigationRepo.findSearchEngineById(
    context.db,
    data.id,
    ownerId,
    includeLegacy,
  );
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.clearDefaultSearchEngine(context.db, ownerId, includeLegacy);
  const updated = await NavigationRepo.updateSearchEngine(
    context.db,
    data.id,
    { isDefault: true },
    ownerId,
    includeLegacy,
  );

  invalidateCache(context);
  return ok(updated);
}

// ============ Admin: Bookmark Folders ============

export async function createFolder(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: CreateFolderInput,
  targetOwnerId?: string,
) {
  const { ownerId } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  const folder = await NavigationRepo.insertFolder(context.db, {
    name: data.name,
    sortOrder: data.sortOrder ?? 0,
    ownerId,
  });
  invalidateCache(context);
  return ok(folder);
}

export async function updateFolder(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: UpdateFolderInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  const existing = await NavigationRepo.findFolderById(
    context.db,
    data.id,
    ownerId,
    includeLegacy,
  );
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  const { id, ...updateData } = data;
  const updated = await NavigationRepo.updateFolder(
    context.db,
    id,
    updateData,
    ownerId,
    includeLegacy,
  );
  invalidateCache(context);
  return ok(updated);
}

export async function deleteFolder(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: DeleteFolderInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  const existing = await NavigationRepo.findFolderById(
    context.db,
    data.id,
    ownerId,
    includeLegacy,
  );
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.deleteFolder(context.db, data.id, ownerId, includeLegacy);
  invalidateCache(context);
  return ok({ success: true });
}

export async function deleteFolders(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: DeleteFoldersInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  await Promise.all(
    data.ids.map((id) =>
      NavigationRepo.deleteFolder(context.db, id, ownerId, includeLegacy),
    ),
  );
  invalidateCache(context);
  return ok({ deleted: data.ids.length });
}

// ============ Admin: Bookmarks ============

export async function createBookmark(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: CreateBookmarkInput,
  targetOwnerId?: string,
) {
  const { ownerId } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  const bookmark = await NavigationRepo.insertBookmark(context.db, {
    folderId: data.folderId ?? null,
    name: data.name,
    url: data.url,
    sortOrder: data.sortOrder ?? 0,
    ownerId,
  });
  invalidateCache(context);
  return ok(bookmark);
}

export async function updateBookmark(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: UpdateBookmarkInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  const existing = await NavigationRepo.findBookmarkById(
    context.db,
    data.id,
    ownerId,
    includeLegacy,
  );
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  const { id, ...updateData } = data;
  const updated = await NavigationRepo.updateBookmark(
    context.db,
    id,
    updateData,
    ownerId,
    includeLegacy,
  );
  invalidateCache(context);
  return ok(updated);
}

export async function deleteBookmark(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: DeleteBookmarkInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  const existing = await NavigationRepo.findBookmarkById(
    context.db,
    data.id,
    ownerId,
    includeLegacy,
  );
  if (!existing) {
    return err({ reason: "NOT_FOUND" });
  }

  await NavigationRepo.deleteBookmark(context.db, data.id, ownerId, includeLegacy);
  invalidateCache(context);
  return ok({ success: true });
}

export async function deleteBookmarks(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: DeleteBookmarksInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  await Promise.all(
    data.ids.map((id) =>
      NavigationRepo.deleteBookmark(context.db, id, ownerId, includeLegacy),
    ),
  );
  invalidateCache(context);
  return ok({ deleted: data.ids.length });
}

// ============ Admin: Import ============

export async function importBookmarks(
  context: AdminContext & { executionCtx: ExecutionContext },
  data: ImportBookmarksInput,
  targetOwnerId?: string,
) {
  const { ownerId, includeLegacy } = resolveOwnerScope(
    context.session.user,
    context.env,
    targetOwnerId,
  );
  const { replace, items } = data;

  if (replace) {
    await NavigationRepo.deleteAllBookmarks(context.db, ownerId, includeLegacy);
    const existingFolders = await NavigationRepo.getAllFolders(
      context.db,
      ownerId,
      includeLegacy,
    );
    await Promise.all(
      existingFolders.map((folder) =>
        NavigationRepo.deleteFolder(context.db, folder.id, ownerId, includeLegacy),
      ),
    );
  }

  let importCount = 0;
  for (const item of items) {
    if (item.bookmarks.length === 0) continue;

    let folderId: number | null = null;
    if (item.folderName) {
      const existingFolder = (
        await NavigationRepo.getAllFolders(context.db, ownerId, includeLegacy)
      ).find((folder) => folder.name === item.folderName);
      const folder = existingFolder
        ? existingFolder
        : await NavigationRepo.insertFolder(context.db, {
            name: item.folderName,
            sortOrder: 0,
            ownerId,
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
        ownerId,
      })),
    );
    importCount += inserted.length;
  }

  invalidateCache(context);
  return ok({ imported: importCount });
}
