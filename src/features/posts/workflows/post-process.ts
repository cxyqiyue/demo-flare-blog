import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import * as CacheService from "@/features/cache/cache.service";
import * as PostRepo from "@/features/posts/data/posts.data";
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

    // 2. Generate summary
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

    // 3. Persist the highlighted public snapshot used by SSR/read paths.
    await step.do("build public content", async () => {
      const db = getDb(this.env);
      const post = await PostRepo.findPostById(db, postId);
      if (!post) return;

      const publicContentJson = post.contentJson
        ? await highlightCodeBlocks(post.contentJson)
        : null;

      await PostRepo.updatePublicContentSnapshot(db, postId, publicContentJson);
    });

    // 4. Update search index (skip for future posts — ScheduledPublishWorkflow handles it)
    const isFuturePost = !!event.payload.isFuturePost;

    if (!isFuturePost) {
      await step.do("update search index", async () => {
        return await upsertPostSearchIndex(this.env, postForSideEffects);
      });
    }

    // 5. Invalidate caches
    await step.do("invalidate caches", async () => {
      await invalidatePostCaches(this.env, postForSideEffects.slug);
    });

    // 6. Update sync hash in KV
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

    // 7. Notify subscribers (future posts are handled by ScheduledPublishWorkflow)
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
