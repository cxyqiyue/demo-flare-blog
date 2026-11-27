import { z } from "zod";
import * as EdgeCacheService from "@/features/cache/edge-cache.service";
import * as PageviewRepo from "@/features/pageview/data/pageview.data";
import {
  PAGEVIEW_CACHE_KEYS,
  ViewCountsSchema,
} from "@/features/pageview/pageview.schema";
import * as PostRepo from "@/features/posts/data/posts.data";
import {
  canReadPost,
  createViewerAccess,
  type ViewerAccess,
} from "@/features/posts/services/post-access.service";

type PageviewContext = DbContext & {
  executionCtx: ExecutionContext;
  viewer?: ViewerAccess;
  session?: AuthContext["session"] | null;
};

function resolveViewer(context: PageviewContext): ViewerAccess {
  return (
    context.viewer ?? createViewerAccess(context.env, context.session?.user)
  );
}

export async function recordPageView(
  context: PageviewContext,
  data: { postId: number; visitorHash: string },
): Promise<void> {
  const post = await PostRepo.findPostGateById(context.db, data.postId);
  if (
    !post ||
    !(await canReadPost(context.env, post, resolveViewer(context)))
  ) {
    return;
  }

  context.executionCtx.waitUntil(
    context.env.QUEUE.send({ type: "PAGEVIEW", data }),
  );
}

export async function getPopularPosts(
  context: DbContext & { executionCtx: ExecutionContext },
  limit = 5,
) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Cache only the popularity order. Hydrate current public metadata on every
  // read so a visibility change cannot expose an old title or summary.
  const slugs = await EdgeCacheService.getVersionedJson(
    context,
    "posts:list",
    (version) => [version, ...PAGEVIEW_CACHE_KEYS.popular, "slugs", limit],
    z.array(z.string()),
    async () => {
      const topPages = await PageviewRepo.getTopPages(
        context.db,
        thirtyDaysAgo,
        now,
        limit,
      );
      return topPages.map((page) => page.slug);
    },
    { ttl: "3h" },
  );
  if (slugs.length === 0) return [];

  const posts = await PostRepo.findPostsBySlugs(context.db, slugs);
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  return slugs.flatMap((slug) => {
    const post = bySlug.get(slug);
    return post ? [post] : [];
  });
}

export async function getViewCounts(
  context: PageviewContext,
  slugs: string[],
): Promise<Record<string, number>> {
  if (slugs.length === 0) return {};

  // Authorization is current request state, never part of the cached response.
  const viewer = resolveViewer(context);
  const gates = await Promise.all(
    [...new Set(slugs)].map(async (slug) => {
      const post = await PostRepo.findPostGateBySlug(context.db, slug);
      return post && (await canReadPost(context.env, post, viewer))
        ? slug
        : null;
    }),
  );
  const readableSlugs = gates.filter((slug): slug is string => slug !== null);
  if (readableSlugs.length === 0) return {};

  // 浏览量缓存键随 slug 组合无上限增长，且高频过期重写，是 KV 写入
  // 配额的头号消耗源 —— 改存 Cache API（免费），KV 只留版本指针类数据
  const counts = await EdgeCacheService.getJson(
    context,
    PAGEVIEW_CACHE_KEYS.viewCounts(readableSlugs),
    ViewCountsSchema,
    () => PageviewRepo.getViewCountsBySlugs(context.db, readableSlugs),
    { ttl: "5m" },
  );
  const readable = new Set(readableSlugs);
  return Object.fromEntries(
    Object.entries(counts).filter(([slug]) => readable.has(slug)),
  );
}
