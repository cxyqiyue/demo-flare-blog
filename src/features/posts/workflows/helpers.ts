import * as CacheService from "@/features/cache/cache.service";
import * as PostService from "@/features/posts/services/posts.service";
import * as SearchService from "@/features/search/service/search.service";
import { getDb } from "@/lib/db";
import { purgePostCDNCache } from "@/lib/invalidate";

export async function fetchPost(env: Env, postId: number) {
  const db = getDb(env);
  return await PostService.findPostById({ db, env }, { id: postId });
}

/**
 * 轮换公开数据缓存 generation（列表/详情/标签）并清理该文章的 CDN 缓存。
 * 数据本体存 Cache API（零 KV 配额），KV 只写版本指针；
 * 轮换后旧 generation 的所有 colo 副本即刻不可达。
 */
export async function invalidatePostCaches(env: Env, slug: string) {
  await Promise.all([
    purgePostCDNCache(env, slug),
    CacheService.bumpVersion({ env }, "posts:list"),
    CacheService.bumpVersion({ env }, "posts:detail"),
    CacheService.bumpVersion({ env }, "tags:list"),
  ]);
}

export async function upsertPostSearchIndex(
  env: Env,
  post: {
    id: number;
    slug: string;
    title: string;
    summary: string | null;
    contentJson: Parameters<typeof SearchService.upsert>[1]["contentJson"];
    tags: Array<{ name: string }>;
  },
) {
  await SearchService.upsert(
    { env },
    {
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      contentJson: post.contentJson,
      tags: post.tags.map((t) => t.name),
    },
  );
}
