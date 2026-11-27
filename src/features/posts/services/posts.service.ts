import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as AiService from "@/features/ai/ai.service";
import * as CacheService from "@/features/cache/cache.service";
import * as EdgeCacheService from "@/features/cache/edge-cache.service";
import {
  assertPostMediaReferencesReadable,
  rewritePostMediaUrls,
} from "@/features/media/service/post-media-access.service";
import {
  ADMIN_LIST_VISIBILITIES,
  PUBLIC_LIST_VISIBILITIES,
} from "@/features/posts/data/helper";
import { syncPostMedia } from "@/features/posts/data/post-media.data";
import * as PostRevisionRepo from "@/features/posts/data/post-revisions.data";
import * as PostRepo from "@/features/posts/data/posts.data";
import { POST_RENDER_VERSION } from "@/features/posts/render-version";
import type {
  AdjacentPostsResponse,
  BatchUpdatePostsStatusInput,
  DeletePostInput,
  FindAdjacentPostsInput,
  FindPostByIdInput,
  FindPostBySlugInput,
  FindRelatedPostsInput,
  GenerateArticleInput,
  GenerateSlugInput,
  GetPostsCountInput,
  GetPostsCursorInput,
  GetPostsInput,
  GetPublicPostsPageInput,
  PreviewSummaryInput,
  PublicPostsPageResponse,
  StartPostProcessInput,
  UpdatePostInput,
} from "@/features/posts/schema/posts.schema";
import {
  normalizePostTagName,
  POSTS_CACHE_KEYS,
  PostWithTocSchema,
} from "@/features/posts/schema/posts.schema";
import {
  canReadPost,
  createViewerAccess,
  UNAUTHENTICATED_VIEWER,
  type ViewerAccess,
} from "@/features/posts/services/post-access.service";
import { logPostAutoSnapshot } from "@/features/posts/services/post-auto-snapshot.logging";
import * as PostAutoSnapshotService from "@/features/posts/services/post-auto-snapshot.service";
import {
  convertToPlainText,
  highlightCodeBlocks,
  slugify,
} from "@/features/posts/utils/content";
import { isFuturePublishDate } from "@/features/posts/utils/date";
import {
  decryptPassword,
  encryptPassword,
  hashPassword,
  verifyPassword,
} from "@/features/posts/utils/post-secret";
import { calculatePostHash } from "@/features/posts/utils/sync";
import { generateTableOfContents } from "@/features/posts/utils/toc";
import * as SearchService from "@/features/search/service/search.service";
import { isSuperAdmin } from "@/lib/auth/access";
import { CategoriesTable, PostCategoriesTable } from "@/lib/db/schema";
import { err, ok } from "@/lib/errors";
import { purgePostCDNCache } from "@/lib/invalidate";

function stripPublicContentJson<T extends { publicContentJson?: unknown }>(
  post: T,
): Omit<T, "publicContentJson"> {
  const { publicContentJson: _publicContentJson, ...rest } = post;
  return rest;
}

/**
 * 文章归属（owner）作用域所需的最小上下文。
 * - Web 管理后台经 adminMiddleware 注入 session → 按归属/超管判定。
 * - MCP 工具没有 session（凭 OAuth scope 鉴权，历史上即全量可见）→ 视为全量管理员。
 */
interface OwnerContext {
  db: DB;
  env: Env;
  session?: Session | null;
}

/** 是否全量权限：无 session（MCP / 无会话）或超级管理员。 */
function isFullAccessOwner(context: OwnerContext) {
  return !context.session || isSuperAdmin(context.session.user, context.env);
}

/** 普通管理员是否可访问某篇由其 authorId 归属的文章（无会话或超级管理员视为全量）。 */
function isPostOwner(context: OwnerContext, authorId: string | null) {
  return isFullAccessOwner(context) || context.session!.user.id === authorId;
}

/** 列表/计数过滤：普通管理员只看自己的文章，其余全量。 */
function authorScopeFilter(context: OwnerContext) {
  return isFullAccessOwner(context) ? undefined : context.session!.user.id;
}

/**
 * 发布/下架等状态切换时的同步快速失效：
 * 在返回响应前轮换公开缓存 generation，让访客无需等待
 * 异步 Workflow（AI 摘要等重活）完成即可看到最新状态。
 * 仅包含轻量的版本指针写入（KV 写次数与管理员操作数同阶）。
 */
async function fastInvalidatePublicCaches(
  env: Env,
  slugs: Array<string>,
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    CacheService.bumpVersion({ env }, "posts:list"),
    CacheService.bumpVersion({ env }, "posts:detail"),
    CacheService.bumpVersion({ env }, "tags:list"),
  ];
  for (const slug of slugs) {
    tasks.push(purgePostCDNCache(env, slug));
  }
  await Promise.all(tasks);
}

function redactLockedListSummaries<
  T extends {
    visibility: string;
    authorId: string | null;
    summary: string | null;
  },
>(posts: T[], viewer?: ViewerAccess): T[] {
  return posts.map((post) =>
    post.visibility === "password" &&
    !viewer?.isSuperAdmin &&
    !(viewer?.userId && viewer.userId === post.authorId)
      ? { ...post, summary: "" }
      : post,
  );
}

export async function getPostsCursor(
  context: DbContext & {
    executionCtx: ExecutionContext;
    viewer?: ViewerAccess;
  },
  data: GetPostsCursorInput,
) {
  const tagName = normalizePostTagName(data.tagName);
  const categoryName = normalizePostTagName(data.categoryName);
  const isSuperAdminViewer = context.viewer?.isSuperAdmin === true;
  const allowedVisibilities = isSuperAdminViewer
    ? ADMIN_LIST_VISIBILITIES
    : PUBLIC_LIST_VISIBILITIES;
  // Visibility and ownership can change independently of eventually consistent
  // cache generations. Always obtain viewer-specific list metadata from D1.
  const result = await PostRepo.getPostsCursor(context.db, {
    cursor: data.cursor,
    limit: data.limit,
    publicOnly: true,
    tagName,
    categoryName,
    excludePinned: data.excludePinned,
    allowedVisibilities,
    privateAuthorId: context.viewer?.userId ?? undefined,
  });
  return {
    ...result,
    items: redactLockedListSummaries(result.items, context.viewer),
  };
}

export async function findPostBySlug(
  context: DbContext & {
    executionCtx: ExecutionContext;
    viewer?: ViewerAccess;
  },
  data: FindPostBySlugInput,
) {
  const viewer = context.viewer ?? UNAUTHENTICATED_VIEWER;
  const fetchContent = async () => {
    const post = await PostRepo.findPostBySlug(context.db, data.slug, {
      publicOnly: true,
      excludeRestricted: false,
    });
    if (!post) return null;
    // Re-check the row used for the body if access changed since the preflight.
    if (!(await canReadPost(context.env, post, viewer))) {
      const currentGate = await PostRepo.findPostGateBySlug(
        context.db,
        data.slug,
      );
      return currentGate ? buildGatedShell(currentGate) : null;
    }

    let contentJson = post.publicContentJson ?? post.contentJson;
    let needsUpdate = false;

    // Backward-compatible fallback for posts that haven't been reprocessed yet.
    if (!post.publicContentJson && contentJson) {
      contentJson = await highlightCodeBlocks(contentJson);
      needsUpdate = true;
    }

    // 懒加载重新渲染：当渲染管线变更（POST_RENDER_VERSION 递增）时，
    // 重新对 contentJson 应用 Shiki 高亮并更新 D1 缓存。
    if (
      !needsUpdate &&
      contentJson &&
      post.publicContentRenderVersion !== POST_RENDER_VERSION
    ) {
      contentJson = await highlightCodeBlocks(contentJson);
      needsUpdate = true;
    }

    if (needsUpdate && contentJson) {
      context.executionCtx.waitUntil(
        PostRepo.updatePublicContentSnapshot(
          context.db,
          post.id,
          contentJson,
          POST_RENDER_VERSION,
        ).then(() => undefined),
      );
    }

    const {
      passwordHash: _passwordHash,
      passwordCipher: _passwordCipher,
      ...safePost
    } = stripPublicContentJson(post);
    return {
      ...safePost,
      contentJson,
      toc: generateTableOfContents(contentJson),
      gate: null,
    };
  };

  // 门禁预检：只取轻量字段，先于任何缓存读取。
  const gateMeta = await PostRepo.findPostGateBySlug(context.db, data.slug);
  if (!gateMeta) return null;

  if (gateMeta.visibility === "public") {
    const post = await EdgeCacheService.getVersionedJson(
      context,
      "posts:detail",
      (version) => POSTS_CACHE_KEYS.detail(version, data.slug),
      PostWithTocSchema,
      fetchContent,
      { ttl: "7d" },
    );
    return post && !post.gate
      ? { ...post, contentJson: await rewritePostMediaUrls(context, post.contentJson) }
      : post;
  }

  // Restricted responses and gate hints must reflect the current row, rather
  // than a seven-day public shell cached under an older permission or password.
  if (await canReadPost(context.env, gateMeta, viewer)) {
    const post = await fetchContent();
    return post && !post.gate
      ? { ...post, contentJson: await rewritePostMediaUrls(context, post.contentJson) }
      : post;
  }
  return buildGatedShell(gateMeta);
}

/** 受限文章的公开壳：仅元信息，无正文；gate 指示前台渲染门禁形态 */
function buildGatedShell(
  gateMeta: NonNullable<
    Awaited<ReturnType<typeof PostRepo.findPostGateBySlug>>
  >,
) {
  const isPrivate = gateMeta.visibility === "private";
  return {
    id: gateMeta.id,
    slug: gateMeta.slug,
    title: isPrivate ? "" : gateMeta.title,
    summary: "",
    readTimeInMinutes: gateMeta.readTimeInMinutes,
    status: gateMeta.status,
    visibility: gateMeta.visibility,
    passwordChannel: isPrivate ? null : gateMeta.passwordChannel,
    passwordHint: isPrivate ? null : gateMeta.passwordHint,
    publishedAt: gateMeta.publishedAt,
    pinnedAt: gateMeta.pinnedAt,
    createdAt: gateMeta.createdAt,
    updatedAt: gateMeta.updatedAt,
    skillId: null,
    authorId: isPrivate ? null : gateMeta.authorId,
    author: isPrivate ? null : (gateMeta.author ?? null),
    publicContentRenderVersion: gateMeta.publicContentRenderVersion,
    tags: [],
    contentJson: null,
    toc: null,
    gate:
      gateMeta.visibility === "password"
        ? ("password" as const)
        : ("private" as const),
  };
}

export async function getRelatedPosts(
  context: DbContext & {
    executionCtx: ExecutionContext;
    viewer?: ViewerAccess;
  },
  data: FindRelatedPostsInput,
) {
  const gate = await PostRepo.findPostGateBySlug(context.db, data.slug);
  if (
    !gate ||
    !(await canReadPost(
      context.env,
      gate,
      context.viewer ?? UNAUTHENTICATED_VIEWER,
    ))
  )
    return [];
  const fetcher = async () => {
    const postIds = await PostRepo.getRelatedPostIds(context.db, data.slug, {
      limit: data.limit,
    });
    return postIds;
  };

  // Cache IDs for 7 days (long-lived cache)
  // This key is NOT dependent on version, so it persists across publishes.
  // 相关文章 ID 组合键数量大，改存 Cache API 避免消耗 KV 写入配额
  const cacheKey = POSTS_CACHE_KEYS.related(data.slug, data.limit);
  const cachedIds = await EdgeCacheService.getJson(
    context,
    cacheKey,
    z.array(z.number()),
    fetcher,
    {
      ttl: "7d",
    },
  );

  if (cachedIds.length === 0) {
    return [];
  }

  // Real-time hydration: fetch actual post data (automatically filters non-published)
  const posts = await PostRepo.getPublicPostsByIds(context.db, cachedIds);

  // Restore order because SQL 'IN' clause doesn't guarantee order
  const orderedPosts = cachedIds
    .map((id) => posts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return redactLockedListSummaries(orderedPosts);
}

export async function getPublicPostsPage(
  context: DbContext & {
    executionCtx: ExecutionContext;
    viewer?: ViewerAccess;
  },
  data: GetPublicPostsPageInput,
): Promise<PublicPostsPageResponse> {
  const offset = data.offset ?? 0;
  const limit = Math.min(data.limit ?? 10, 50);
  const paginatePinned = data.paginatePinned === "true";
  const isSuperAdminViewer = context.viewer?.isSuperAdmin === true;
  const allowedVisibilities = isSuperAdminViewer
    ? ADMIN_LIST_VISIBILITIES
    : PUBLIC_LIST_VISIBILITIES;

  const { items, total, pageItemCount } = await PostRepo.getPublicPostsPage(
    context.db,
    {
      offset,
      limit,
      allowedVisibilities,
      privateAuthorId: context.viewer?.userId ?? undefined,
      paginatePinned,
    },
  );
  return {
    items: redactLockedListSummaries(items, context.viewer),
    total,
    offset,
    limit,
    hasNextPage: offset + pageItemCount < total,
    hasPrevPage: offset > 0,
  };
}

export async function findAdjacentPosts(
  context: DbContext & {
    executionCtx: ExecutionContext;
    viewer?: ViewerAccess;
  },
  data: FindAdjacentPostsInput,
): Promise<AdjacentPostsResponse> {
  const gate = await PostRepo.findPostGateBySlug(context.db, data.slug);
  if (
    !gate ||
    !(await canReadPost(
      context.env,
      gate,
      context.viewer ?? UNAUTHENTICATED_VIEWER,
    ))
  ) {
    return { previous: null, next: null };
  }
  return await PostRepo.findAdjacentPosts(context.db, data.slug);
}

export async function generateSummaryByPostId({
  context,
  postId,
}: {
  context: DbContext & { executionCtx: ExecutionContext };
  postId: number;
}) {
  const post = await PostRepo.findPostById(context.db, postId);

  if (!post) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  // 如果已经存在摘要，则直接返回
  if (post.summary && post.summary.trim().length > 0) return ok(post);

  const plainText = convertToPlainText(post.contentJson);
  if (plainText.length < 100) {
    return ok(post);
  }

  const { summary } = await AiService.summarizeText(context, plainText);

  const updatedPost = await PostRepo.updatePost(context.db, post.id, {
    summary,
  });

  if (!updatedPost) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  return ok(stripPublicContentJson(updatedPost));
}

// ============ Admin Service Methods ============

export async function generateSlug(
  context: DbContext,
  data: GenerateSlugInput,
) {
  const baseSlug = slugify(data.title);
  // 1. 先查有没有完全一样的 (比如 'hello-world')
  const exactMatch = await PostRepo.slugExists(context.db, baseSlug, {
    excludeId: data.excludeId,
  });
  if (!exactMatch) {
    return { slug: baseSlug };
  }

  // 2. 既然 'hello-world' 被占了，那就查所有 'hello-world-%' 的
  const similarSlugs = await PostRepo.findSimilarSlugs(context.db, baseSlug, {
    excludeId: data.excludeId,
  });

  // 3. 在内存里找最大的数字后缀
  // 正则含义：匹配以 "-数字" 结尾的字符串，并捕获那个数字
  const regex = new RegExp(`^${baseSlug}-(\\d+)$`);

  let maxSuffix = 0;
  for (const slug of similarSlugs) {
    const match = slug.match(regex);
    if (match) {
      const number = parseInt(match[1], 10);
      if (number > maxSuffix) {
        maxSuffix = number;
      }
    }
  }

  // 4. 结果就是最大值 + 1
  return { slug: `${baseSlug}-${maxSuffix + 1}` };
}

export async function createEmptyPost(context: OwnerContext) {
  const { slug } = await generateSlug(context, { title: "" });

  const post = await PostRepo.insertPost(context.db, {
    title: "",
    slug,
    summary: "",
    status: "draft",
    readTimeInMinutes: 1,
    contentJson: null,
    // 归属作者：Web 管理为当前登录用户；无会话（MCP）置空。
    authorId: context.session?.user.id ?? null,
  });

  // No cache/index operations for drafts

  return { id: post.id };
}

export async function getPosts(context: OwnerContext, data: GetPostsInput) {
  // 普通管理员只能看到自己创建的文章；超级管理员（或无会话的 MCP）可看到全部。
  const authorId = authorScopeFilter(context);
  return await PostRepo.getPosts(context.db, {
    offset: data.offset ?? 0,
    limit: data.limit ?? 10,
    status: data.status,
    publicOnly: data.publicOnly,
    search: data.search,
    sortDir: data.sortDir,
    sortBy: data.sortBy,
    authorId,
  });
}

export async function getPostsCount(
  context: OwnerContext,
  data: GetPostsCountInput,
) {
  const authorId = authorScopeFilter(context);
  return await PostRepo.getPostsCount(context.db, {
    status: data.status,
    publicOnly: data.publicOnly,
    search: data.search,
    authorId,
  });
}

export async function findPostBySlugAdmin(
  context: OwnerContext,
  data: FindPostBySlugInput,
) {
  const post = await PostRepo.findPostBySlug(context.db, data.slug, {
    publicOnly: false,
  });
  if (!post || !isPostOwner(context, post.authorId)) return null;
  const {
    passwordHash: _passwordHash,
    passwordCipher: _passwordCipher,
    ...safePost
  } = stripPublicContentJson(post);
  return {
    ...safePost,
    toc: generateTableOfContents(post.contentJson),
  };
}

export async function findPostById(
  context: OwnerContext,
  data: FindPostByIdInput,
) {
  const post = await PostRepo.findPostById(context.db, data.id);
  if (!post) return null;

  // 普通管理员只能读取/编辑自己创建的文章；超级管理员（或无会话的 MCP）可读取全部。
  if (!isPostOwner(context, post.authorId)) {
    return null;
  }

  const kvHash = await CacheService.getRaw(
    context,
    POSTS_CACHE_KEYS.syncHash(post.id),
  );
  const hasPublicCache = kvHash !== null;

  let isSynced: boolean;
  if (post.status === "draft") {
    // 草稿：同步 = KV 中没有旧缓存
    isSynced = !hasPublicCache;
  } else {
    // 已发布：同步 = 内容 hash 一致
    const dbHash = await calculatePostHash({
      title: post.title,
      contentJson: post.contentJson,
      summary: post.summary,
      tagIds: post.tags.map((t) => t.id),
      categoryId: post.categoryId,
      slug: post.slug,
      publishedAt: post.publishedAt,
      pinnedAt: post.pinnedAt,
      readTimeInMinutes: post.readTimeInMinutes,
    });
    isSynced = dbHash === kvHash;
  }

  // 管理端读取：解密访问密码明文供编辑器展示；绝不进公开响应。
  const password = await decryptPassword(post.passwordCipher, context.env);
  const publicPost = stripPublicContentJson(post);
  const {
    passwordHash: _passwordHash,
    passwordCipher: _passwordCipher,
    ...rest
  } = publicPost;
  void _passwordHash;
  void _passwordCipher;

  return {
    ...rest,
    visibility: post.visibility,
    password,
    passwordChannel: post.passwordChannel,
    passwordHint: post.passwordHint,
    isSynced,
    hasPublicCache,
  };
}

export async function updatePost(
  context: OwnerContext & { executionCtx: ExecutionContext },
  data: UpdatePostInput,
) {
  const existingPost = await PostRepo.findPostById(context.db, data.id);
  if (!existingPost) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  const actorIsSuper = isFullAccessOwner(context);
  // 普通管理员只能更新自己创建的文章；超级管理员（或无会话的 MCP）可更新全部。
  if (!actorIsSuper && existingPost.authorId !== context.session!.user.id) {
    return err({ reason: "PERMISSION_DENIED" });
  }

  // 密码门禁：编辑器传来明文 password（不含 passwordHash/passwordCipher）。
  // 服务端在此派生安全字段后落库，确保明文/杂凑的生成只在服务端完成。
  const {
    password: plainPassword,
    categoryId: _categoryId,
    ...input
  } = data.data;
  const persisted: Parameters<typeof PostRepo.updatePost>[2] = { ...input };
  // Enforce server-only derivation even for internal callers bypassing the API schema.
  delete persisted.passwordHash;
  delete persisted.passwordCipher;

  if (data.data.categoryId != null) {
    const category = await context.db
      .select({ id: CategoriesTable.id })
      .from(CategoriesTable)
      .where(eq(CategoriesTable.id, data.data.categoryId))
      .get();
    if (!category) return err({ reason: "CATEGORY_NOT_FOUND" });
  }

  // 作者归属：普通管理员不得修改作者（强制保留原作者）；
  // 超级管理员可修改 authorId（若编辑器提交）。
  if (actorIsSuper) {
    if (data.data.authorId === null || data.data.authorId === "") {
      delete persisted.authorId;
    }
  } else {
    delete persisted.authorId;
  }

  const visibility = persisted.visibility ?? existingPost.visibility;
  if (visibility !== "password") {
    // Removing the hash revokes previously issued grants, including on mode changes.
    persisted.passwordHash = null;
    persisted.passwordCipher = null;
  } else if (typeof plainPassword === "string" && plainPassword !== "") {
    if (!plainPassword.trim()) return err({ reason: "PASSWORD_REQUIRED" });
    // Autosave resubmits the decrypted value. Keep the hash stable unless the
    // password actually changes so unrelated edits do not invalidate grants.
    if (!(await verifyPassword(plainPassword, existingPost.passwordHash))) {
      persisted.passwordHash = await hashPassword(plainPassword);
      persisted.passwordCipher = await encryptPassword(
        plainPassword,
        context.env,
      );
    } else if (!existingPost.passwordCipher) {
      persisted.passwordCipher = await encryptPassword(
        plainPassword,
        context.env,
      );
    }
  } else if (!existingPost.passwordHash) {
    return err({ reason: "PASSWORD_REQUIRED" });
  }

  if (persisted.contentJson !== undefined && !actorIsSuper) {
    const readable = await assertPostMediaReferencesReadable(
      {
        db: context.db,
        env: context.env,
        viewer: createViewerAccess(context.env, context.session?.user),
      },
      existingPost.contentJson,
      persisted.contentJson,
    );
    if (!readable) return err({ reason: "PERMISSION_DENIED" });
  }

  const updatedPost = Object.values(persisted).some(
    (value) => value !== undefined,
  )
    ? await PostRepo.updatePost(context.db, data.id, persisted)
    : existingPost;
  if (!updatedPost) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  if (data.data.categoryId !== undefined) {
    await context.db
      .insert(PostCategoriesTable)
      .values({ postId: data.id, categoryId: data.data.categoryId })
      .onConflictDoUpdate({
        target: PostCategoriesTable.postId,
        set: { categoryId: data.data.categoryId },
      });
  }

  const accessChanged =
    existingPost.visibility !== updatedPost.visibility ||
    existingPost.passwordHash !== updatedPost.passwordHash ||
    existingPost.authorId !== updatedPost.authorId;
  const publicationChanged =
    existingPost.status !== updatedPost.status ||
    existingPost.slug !== updatedPost.slug ||
    existingPost.publishedAt?.getTime() !== updatedPost.publishedAt?.getTime();
  const pinnedAtChanged =
    existingPost.pinnedAt?.getTime() !== updatedPost.pinnedAt?.getTime();

  if (
    (accessChanged || publicationChanged || pinnedAtChanged) &&
    (existingPost.status === "published" || updatedPost.status === "published")
  ) {
    // Revocation takes effect at D1 reads immediately; refresh derived stores
    // as part of this request as well, rather than waiting for a later Publish.
    const tasks: Array<Promise<unknown>> = [
      fastInvalidatePublicCaches(context.env, [
        ...new Set([existingPost.slug, updatedPost.slug]),
      ]),
      CacheService.deleteKey(
        context,
        POSTS_CACHE_KEYS.syncHash(updatedPost.id),
      ),
    ];
    if (
      updatedPost.visibility !== "public" ||
      updatedPost.status !== "published" ||
      !updatedPost.publishedAt ||
      updatedPost.publishedAt > new Date()
    ) {
      tasks.push(
        SearchService.deleteIndex(
          context,
          { id: updatedPost.id },
          { immediate: true },
        ),
      );
    } else if (accessChanged || publicationChanged) {
      tasks.push(
        SearchService.upsert(
          context,
          {
            id: updatedPost.id,
            slug: updatedPost.slug,
            title: updatedPost.title,
            summary: updatedPost.summary,
            contentJson:
              updatedPost.publicContentJson ?? updatedPost.contentJson,
            tags: existingPost.tags.map((tag) => tag.name),
          },
          { immediate: true },
        ),
      );
    }
    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          "Post access side-effect refresh failed",
          updatedPost.id,
          result.reason,
        );
      }
    }
  }

  if (data.data.contentJson !== undefined) {
    context.executionCtx.waitUntil(
      syncPostMedia(context.db, updatedPost.id, data.data.contentJson),
    );
  }

  context.executionCtx.waitUntil(
    PostAutoSnapshotService.enqueuePostAutoSnapshot(context, {
      postId: updatedPost.id,
      source: "post_update",
    }),
  );

  const {
    passwordHash: _passwordHash,
    passwordCipher: _passwordCipher,
    ...safeUpdatedPost
  } = stripPublicContentJson(updatedPost);
  return ok({
    ...safeUpdatedPost,
    categoryId:
      data.data.categoryId === undefined
        ? existingPost.categoryId
        : data.data.categoryId,
  });
}

/**
 * Batch-publish or batch-move-to-draft a set of posts.
 * Order is preserved: `updatedAt` and existing `publishedAt` are untouched,
 * and previously unpublished posts share one timestamp within the batch.
 */
export async function batchUpdatePostsStatus(
  context: OwnerContext & { executionCtx: ExecutionContext },
  data: BatchUpdatePostsStatusInput,
) {
  const actorIsFullAccess = isFullAccessOwner(context);
  let existing = await PostRepo.findPostsByIds(context.db, data.ids);
  // 普通管理员批量操作仅作用于自己创建的文章；其他人文章被跳过。
  if (!actorIsFullAccess) {
    existing = existing.filter(
      (post) => post.authorId === context.session!.user.id,
    );
  }
  if (existing.length === 0) {
    return ok({ updated: 0, skipped: data.ids.length });
  }

  const affected = existing.filter((post) => post.status !== data.status);
  const skipped = data.ids.length - affected.length;

  if (affected.length > 0) {
    await PostRepo.batchUpdatePostsStatus(
      context.db,
      affected.map((post) => post.id),
      data.status,
    );
  }

  const isPublished = data.status === "published";

  // Trigger content snapshot / search index / cache invalidation per post
  for (const post of affected) {
    let publishedAtISO: string | undefined;
    if (isPublished) {
      await context.db
        .update(PostCategoriesTable)
        .set({ publicCategoryId: sql`${PostCategoriesTable.categoryId}` })
        .where(eq(PostCategoriesTable.postId, post.id));
      const latest = await PostRepo.findPostById(context.db, post.id);
      publishedAtISO = (latest?.publishedAt ?? new Date()).toISOString();
    }

    context.executionCtx.waitUntil(
      (async () => {
        try {
          await context.env.POST_PROCESS_WORKFLOW.create({
            params: {
              postId: post.id,
              isPublished,
              publishedAt: publishedAtISO,
              isFuturePost: false,
            },
          });
        } catch (error) {
          // DB status is already committed; never let a workflow-scheduling
          // failure turn the batch request into an error. Cache/index cleanup
          // degradation is logged for later investigation.
          console.error(
            JSON.stringify({
              message:
                "post process workflow create failed for batch status update",
              postId: post.id,
              error: String(error),
            }),
          );
        }
      })(),
    );
  }

  // 同步快速失效：批量发布/下架后立即轮换公开缓存，
  // 不等异步 Workflow 完成（重活由 Workflow 继续处理）
  if (affected.length > 0) {
    const slugs = affected.map((post) => post.slug);
    context.executionCtx.waitUntil(
      fastInvalidatePublicCaches(context.env, slugs).catch((error) => {
        console.error(
          JSON.stringify({
            message: "fast invalidate public caches failed for batch update",
            slugs,
            error: String(error),
          }),
        );
      }),
    );
  }

  return ok({ updated: affected.length, skipped });
}

export async function deletePost(
  context: OwnerContext & { executionCtx: ExecutionContext },
  data: DeletePostInput,
) {
  const post = await PostRepo.findPostById(context.db, data.id);
  if (!post) {
    return err({ reason: "POST_NOT_FOUND" });
  }

  // 普通管理员只能删除自己创建的文章；超级管理员（或无会话的 MCP）可删除全部。
  if (!isPostOwner(context, post.authorId)) {
    return err({ reason: "PERMISSION_DENIED" });
  }

  await PostRepo.deletePost(context.db, data.id);

  // Only clear cache/index for published posts
  if (post.status === "published") {
    const tasks = [];
    tasks.push(CacheService.bumpVersion(context, "posts:detail"));
    tasks.push(CacheService.bumpVersion(context, "posts:list"));
    tasks.push(CacheService.bumpVersion(context, "tags:list"));
    tasks.push(
      SearchService.deleteIndex(context, { id: data.id }, { immediate: true }),
    );
    tasks.push(purgePostCDNCache(context.env, post.slug));
    tasks.push(
      CacheService.deleteKey(context, POSTS_CACHE_KEYS.syncHash(data.id)),
    );

    context.executionCtx.waitUntil(Promise.all(tasks));
  } else {
    // Even for drafts, clean up hash if exists
    context.executionCtx.waitUntil(
      CacheService.deleteKey(context, POSTS_CACHE_KEYS.syncHash(data.id)),
    );
  }

  return ok({ success: true });
}

export async function previewSummary(
  context: DbContext & { executionCtx: ExecutionContext },
  data: PreviewSummaryInput,
) {
  const plainText = convertToPlainText(data.contentJson);
  const { summary } = await AiService.summarizeText(context, plainText);
  return { summary };
}

export async function generateArticle(
  context: DbContext & { executionCtx: ExecutionContext },
  data: GenerateArticleInput,
) {
  return await AiService.generateArticle(context, data);
}

export async function startPostProcessWorkflow(
  context: DbContext,
  data: StartPostProcessInput,
) {
  let publishedAtISO: string | undefined;

  if (data.status === "published") {
    const post = await PostRepo.findPostById(context.db, data.id);
    if (post) {
      await context.db
        .update(PostCategoriesTable)
        .set({ publicCategoryId: sql`${PostCategoriesTable.categoryId}` })
        .where(eq(PostCategoriesTable.postId, data.id));
      const snapshotHash = await calculatePostHash({
        title: post.title,
        contentJson: post.contentJson,
        summary: post.summary,
        tagIds: post.tags.map((tag) => tag.id),
        categoryId: post.categoryId,
        slug: post.slug,
        publishedAt: post.publishedAt,
        pinnedAt: post.pinnedAt,
        readTimeInMinutes: post.readTimeInMinutes,
      });

      await PostRevisionRepo.insertPostRevision(context.db, {
        postId: post.id,
        reason: "publish",
        snapshotHash,
        snapshotJson: {
          title: post.title,
          summary: post.summary,
          slug: post.slug,
          status: post.status,
          publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
          readTimeInMinutes: post.readTimeInMinutes,
          contentJson: post.contentJson,
          ...(post.categoryId != null ? { categoryId: post.categoryId } : {}),
          tagIds: [...new Set(post.tags.map((tag) => tag.id))].sort(
            (a, b) => a - b,
          ),
        },
      });

      logPostAutoSnapshot(context.env, "publish_revision_created", {
        postId: post.id,
        reason: "publish",
        snapshotHash,
      });
    }
  }

  // Check if we need to auto-set the published date
  if (data.status === "published") {
    const post = await PostRepo.findPostById(context.db, data.id);
    if (post && !post.publishedAt) {
      const now = new Date();
      await PostRepo.updatePost(context.db, post.id, {
        publishedAt: now,
      });
      publishedAtISO = now.toISOString();
    } else if (post?.publishedAt) {
      publishedAtISO = post.publishedAt.toISOString();
    }
  }

  const isFuture =
    !!publishedAtISO && isFuturePublishDate(publishedAtISO, data.clientToday);

  // 同步快速失效：发布/下架动作立即轮换公开缓存，让访客在
  // 异步 Workflow（AI 摘要、搜索索引等重活）完成前就能看到最新状态。
  // 定时发布的文章尚未对公众可见，交给 ScheduledPublishWorkflow 处理。
  if (!isFuture) {
    try {
      const post = await PostRepo.findPostById(context.db, data.id);
      if (post) {
        await fastInvalidatePublicCaches(context.env, [post.slug]);
      }
    } catch (error) {
      // 快速失效失败不阻断发布流程；Workflow 内的 invalidate 步骤会兜底
      console.error(
        JSON.stringify({
          message: "fast invalidate public caches failed on publish action",
          postId: data.id,
          error: String(error),
        }),
      );
    }
  }

  await context.env.POST_PROCESS_WORKFLOW.create({
    params: {
      postId: data.id,
      isPublished: data.status === "published",
      publishedAt: publishedAtISO,
      isFuturePost: isFuture,
    },
  });

  // Defensively terminate any existing scheduled publish workflow for this post
  const scheduledId = `post-${data.id}-scheduled`;
  try {
    const oldInstance =
      await context.env.SCHEDULED_PUBLISH_WORKFLOW.get(scheduledId);
    await oldInstance.terminate();
  } catch {
    // Instance doesn't exist or already completed, ignore
  }

  // If this is a future post, create a new scheduled publish workflow
  if (data.status === "published" && isFuture) {
    await context.env.SCHEDULED_PUBLISH_WORKFLOW.createBatch([
      {
        id: scheduledId,
        params: { postId: data.id, publishedAt: publishedAtISO! },
      },
    ]);
  }
}
