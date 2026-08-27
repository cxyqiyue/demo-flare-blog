import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import * as CacheService from "@/features/cache/cache.service";
import * as PostRepo from "@/features/posts/data/posts.data";
import { POST_RENDER_VERSION } from "@/features/posts/render-version";
import { POSTS_CACHE_KEYS } from "@/features/posts/schema/posts.schema";
import * as PostService from "@/features/posts/services/posts.service";
import { highlightCodeBlocks } from "@/features/posts/utils/content";
import { calculatePostHash } from "@/features/posts/utils/sync";
import {
  fetchPost,
  invalidatePostCaches,
  upsertPostSearchIndex,
} from "@/features/posts/workflows/helpers";
import * as SearchService from "@/features/search/service/search.service";
import * as SubscriptionService from "@/features/subscription/service/subscription.service";
import { getDb } from "@/lib/db";

interface Params {
  postId: number;
  isPublished: boolean;
  publishedAt?: string; // ISO 8601
  isFuturePost?: boolean;
}

export class PostProcessWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { postId, isPublished } = event.payload;

    if (isPublished) {
      await this.handlePublish(event, step, postId);
    } else {
      await this.handleUnpublish(step, postId);
    }
  }

  private async handlePublish(
    event: WorkflowEvent<Params>,
    step: WorkflowStep,
    postId: number,
  ) {
    // 1. Fetch post and Check Sync Status
    const { post: initialPost, shouldSkip } = await step.do(
      "check sync status",
      async () => {
        const db = getDb(this.env);
        const p = await PostRepo.findPostById(db, postId);
        if (!p) return { post: null, shouldSkip: true };

        const newHash = await calculatePostHash({
          title: p.title,
          contentJson: p.contentJson,
          summary: p.summary,
          tagIds: p.tags.map((t) => t.id),
          slug: p.slug,
          publishedAt: p.publishedAt,
          pinnedAt: p.pinnedAt,
          readTimeInMinutes: p.readTimeInMinutes,
        });
        const oldHash = await CacheService.getRaw(
          { env: this.env },
          POSTS_CACHE_KEYS.syncHash(postId),
        );
        const needsPublicContentBuild = !!p.contentJson && !p.publicContentJson;

        if (newHash === oldHash && !needsPublicContentBuild) {
          console.log(
            JSON.stringify({ message: "Content unchanged, skipping", postId }),
          );
          return { post: p, shouldSkip: true };
        }

        return { post: p, shouldSkip: false };
      },
    );

    if (shouldSkip || !initialPost) return;

    // 2. Persist the highlighted public snapshot used by SSR/read paths.
    await step.do("build public content", async () => {
      const db = getDb(this.env);
      const post = await PostRepo.findPostById(db, postId);
      if (!post) return;

      const publicContentJson = post.contentJson
        ? await highlightCodeBlocks(post.contentJson)
        : null;

      await PostRepo.updatePublicContentSnapshot(
        db,
        postId,
        publicContentJson,
        POST_RENDER_VERSION,
      );
    });

    // 3. Invalidate caches EARLY so the new post is visible immediately.
    //    AI 摘要生成可能耗时数分钟（含重试），不能让它阻塞内容可见性；
    //    摘要完成后再做第二次轮换刷新列表/详情中的摘要字段。
    //    fastInvalidatePublicCaches 已轮换版本指针，此处跳过以避免重复 KV 写入。
    await step.do("invalidate caches", async () => {
      await invalidatePostCaches(this.env, initialPost.slug, {
        skipVersionBump: true,
      });
    });

    // 4. Generate summary
    const updatedPost = await step.do(
      `generate summary for post ${postId}`,
      {
        retries: {
          limit: 3,
          delay: "5 seconds",
          backoff: "exponential",
        },
      },
      async () => {
        const db = getDb(this.env);
        const result = await PostService.generateSummaryByPostId({
          context: { db, env: this.env, executionCtx: this.ctx },
          postId,
        });
        if (result.error) {
          return null;
        }
        return result.data;
      },
    );
    // Summary generation failure must NOT abort the publish flow: the public
    // snapshot, search index and cache invalidation still need to run so the
    // newly published post becomes visible. Fall back to the initial snapshot.
    const postForSideEffects = updatedPost ?? initialPost;
    if (!postForSideEffects) return;

    // 5. Update search index (skip for future posts — ScheduledPublishWorkflow handles it)
    const isFuturePost = !!event.payload.isFuturePost;

    if (!isFuturePost) {
      await step.do("update search index", async () => {
        const result = await upsertPostSearchIndex(
          this.env,
          postForSideEffects,
        );
        // 搜索索引延迟写入 KV（~5s 去抖），保持 Worker 存活直到写入完成
        if (result.flushPromise) {
          this.ctx.waitUntil(result.flushPromise);
        }
      });
    }

    // 6. Re-invalidate caches when a NEW summary was generated, so lists and
    //    detail pages pick it up instead of serving the pre-summary snapshot
    //    for the remaining TTL.
    //    版本指针已在 fastInvalidatePublicCaches 中轮换，此处仅清理 CDN。
    const summaryChanged =
      !!updatedPost && updatedPost.summary !== initialPost.summary;
    if (!isFuturePost && summaryChanged) {
      await step.do("invalidate caches after summary", async () => {
        await invalidatePostCaches(this.env, postForSideEffects.slug, {
          skipVersionBump: true,
        });
      });
    }

    // 7. Update sync hash in KV
    await step.do("update sync hash", async () => {
      const p = await fetchPost(this.env, postId);
      if (!p) return;

      const hash = await calculatePostHash({
        title: p.title,
        contentJson: p.contentJson,
        summary: p.summary,
        tagIds: p.tags.map((t) => t.id),
        slug: p.slug,
        publishedAt: p.publishedAt,
        pinnedAt: p.pinnedAt,
        readTimeInMinutes: p.readTimeInMinutes,
      });
      await CacheService.set(
        { env: this.env },
        POSTS_CACHE_KEYS.syncHash(postId),
        hash,
      );
    });

    // 8. Notify subscribers (future posts are handled by ScheduledPublishWorkflow)
    if (!isFuturePost) {
      await step.do("notify subscribers", async () => {
        const p = await fetchPost(this.env, postId);
        if (!p || p.status !== "published") return;

        await SubscriptionService.notifySubscribersOfNewPost(
          { db: getDb(this.env), env: this.env },
          { id: p.id, title: p.title, slug: p.slug },
        );
      });
    }
  }

  private async handleUnpublish(step: WorkflowStep, postId: number) {
    const post = await step.do("fetch post", async () => {
      return await fetchPost(this.env, postId);
    });

    if (!post) return;

    await step.do("remove from search index", async () => {
      return await SearchService.deleteIndex({ env: this.env }, { id: postId });
    });

    await step.do("invalidate caches", async () => {
      await invalidatePostCaches(this.env, post.slug);
      await CacheService.deleteKey(
        { env: this.env },
        POSTS_CACHE_KEYS.syncHash(postId),
      );
    });
  }
}
