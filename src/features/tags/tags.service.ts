import { z } from "zod";
import * as CacheService from "@/features/cache/cache.service";
import * as EdgeCacheService from "@/features/cache/edge-cache.service";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as PostAutoSnapshotService from "@/features/posts/services/post-auto-snapshot.service";
import * as TagRepo from "@/features/tags/data/tags.data";
import type {
  CreateTagInput,
  DeleteTagInput,
  GetTagsByPostIdInput,
  GetTagsInput,
  SetPostTagsInput,
  Tag,
  TagWithCount,
  UpdateTagInput,
} from "@/features/tags/tags.schema";
import {
  TAGS_CACHE_KEYS,
  TagWithCountSchema,
} from "@/features/tags/tags.schema";
import { err, ok } from "@/lib/errors";
import { purgeCDNCache } from "@/lib/invalidate";

/**
 * Get all tags (cached)
 */
export async function getTags(
  context: DbContext,
  data: GetTagsInput = {},
): Promise<Array<Tag | TagWithCount>> {
  const {
    sortBy = "name",
    sortDir = "asc",
    withCount = false,
    publicOnly = false,
  } = data;

  if (withCount) {
    return await TagRepo.getAllTagsWithCount(context.db, {
      sortBy,
      sortDir,
      publicOnly,
    });
  }
  return await TagRepo.getAllTags(context.db, {
    sortBy: sortBy === "postCount" ? "name" : sortBy,
    sortDir,
  });
}

/**
 * Get public tags list (edge-cached, invalidated by tags:list generation bump)
 * This ensures public site only shows "published" tag associations.
 */
export async function getPublicTags(
  context: DbContext & {
    executionCtx: ExecutionContext;
  },
) {
  // 标签云是全站高频读取，改存 Cache API（零 KV 配额），
  // 失效语义由 bumpVersion("tags:list") 轮换 generation 保留
  return await EdgeCacheService.getVersionedJson(
    context,
    "tags:list",
    (version) => [version, ...TAGS_CACHE_KEYS.publicList],
    z.array(TagWithCountSchema),
    async () => {
      return await TagRepo.getAllTagsWithCount(context.db, {
        publicOnly: true,
        sortBy: "postCount",
        sortDir: "desc",
      });
    },
    { ttl: "7d" },
  );
}

/**
 * Get all tags with counts
 */
export async function getTagsWithCount(
  context: DbContext,
  data: GetTagsInput = {},
) {
  // We don't cache this for now as it's for admin management
  return await TagRepo.getAllTagsWithCount(context.db, data);
}

/**
 * Get tags for a specific post
 */
export async function getTagsByPostId(
  context: DbContext,
  data: GetTagsByPostIdInput,
) {
  return await TagRepo.getTagsByPostId(context.db, data.postId);
}

// ============ Admin Service Methods ============

/**
 * Create a new tag
 */

/**
 * Helper to invalidate caches related to tags and their associated posts.
 *
 * 采用保守策略：
 * 1. 无论如何都轮换 tags:list generation（标签变动必然影响标签云）
 * 2. 如果有受影响的文章，轮换文章缓存 generation 并清理对应 CDN 缓存
 * 3. 如果没有受影响的文章（可能是 DB/缓存不同步），bump 所有版本号
 */
async function invalidateTagRelatedCache(
  context: DbContext,
  affectedPosts: Array<{ id: number; slug: string }>,
) {
  // 1. 无论如何都轮换标签云 generation
  await CacheService.bumpVersion(context, "tags:list");

  if (affectedPosts.length > 0) {
    // 2. 轮换文章缓存 generation 并清理受影响文章的 CDN 缓存
    const cdnUrls = ["/", "/posts"];
    for (const post of affectedPosts) {
      cdnUrls.push(`/post/${encodeURIComponent(post.slug)}`);
    }

    await Promise.all([
      CacheService.bumpVersion(context, "posts:list"),
      CacheService.bumpVersion(context, "posts:detail"),
      purgeCDNCache(context.env, { urls: cdnUrls }),
    ]);
  } else {
    // 3. 保守策略：可能是 DB/缓存不同步，bump 所有版本号
    await Promise.all([
      CacheService.bumpVersion(context, "posts:detail"),
      CacheService.bumpVersion(context, "posts:list"),
      purgeCDNCache(context.env, { urls: ["/", "/posts"] }),
    ]);
  }
}

export const createTag = async (context: DbContext, data: CreateTagInput) => {
  const exists = await TagRepo.nameExists(context.db, data.name);
  if (exists) {
    return err({ reason: "TAG_NAME_ALREADY_EXISTS" });
  }

  const tag = await TagRepo.insertTag(context.db, {
    name: data.name,
  });

  return ok(tag);
};

/**
 * Update a tag
 */
export async function updateTag(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateTagInput,
) {
  const existingTag = await TagRepo.findTagById(context.db, data.id);
  if (!existingTag) {
    return err({ reason: "TAG_NOT_FOUND" });
  }

  if (data.data.name && data.data.name !== existingTag.name) {
    const exists = await TagRepo.nameExists(context.db, data.data.name, {
      excludeId: data.id,
    });
    if (exists) {
      return err({ reason: "TAG_NAME_ALREADY_EXISTS" });
    }
  }

  const affectedPosts = await TagRepo.getPublishedPostsByTagId(
    context.db,
    data.id,
  );

  const tag = await TagRepo.updateTag(context.db, data.id, data.data);

  context.executionCtx.waitUntil(
    invalidateTagRelatedCache(context, affectedPosts),
  );

  return ok(tag);
}

/**
 * Delete a tag
 */
export async function deleteTag(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteTagInput,
) {
  const tag = await TagRepo.findTagById(context.db, data.id);
  if (!tag) {
    return err({ reason: "TAG_NOT_FOUND" });
  }

  // Fetch published posts associated with this tag BEFORE deleting
  const affectedPosts = await TagRepo.getPublishedPostsByTagId(
    context.db,
    data.id,
  );

  await TagRepo.deleteTag(context.db, data.id);

  context.executionCtx.waitUntil(
    invalidateTagRelatedCache(context, affectedPosts),
  );

  return ok({ success: true });
}

/**
 * Set tags for a post (edit only, no cache invalidation)
 *
 * 编辑页面改标签只影响 DB，不触发 KV 变化。
 * KV 只在"发布"时刷新。
 */
export async function setPostTags(context: DbContext, data: SetPostTagsInput) {
  await TagRepo.setPostTags(context.db, data.postId, data.tagIds);
  await PostRepo.touchPostUpdatedAt(context.db, data.postId);
  await PostAutoSnapshotService.enqueuePostAutoSnapshot(context, {
    postId: data.postId,
    source: "tag_update",
  });
}
