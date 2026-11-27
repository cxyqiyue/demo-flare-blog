import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { toUTCMidnight } from "@/features/posts/utils/date";
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
  publishedAt: string; // ISO 8601
}

export class ScheduledPublishWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { postId } = event.payload;

    await step.sleepUntil(
      "sleep until publish date",
      toUTCMidnight(new Date(event.payload.publishedAt)),
    );

    const post = await step.do("verify post status", async () => {
      return await fetchPost(this.env, postId);
    });

    if (!post || post.status !== "published") return;

    await step.do("invalidate caches", async () => {
      await invalidatePostCaches(this.env, post.slug);
    });

    await step.do("update search index", async () => {
      const currentPost = await fetchPost(this.env, postId);
      if (
        !currentPost ||
        currentPost.status !== "published" ||
        !currentPost.publishedAt ||
        currentPost.publishedAt > new Date()
      ) {
        await SearchService.deleteIndex(
          { env: this.env },
          { id: postId },
          { immediate: true },
        );
        return;
      }
      const result = await upsertPostSearchIndex(this.env, currentPost);
      if (result.flushPromise) {
        this.ctx.waitUntil(result.flushPromise);
      }
    });

    await step.do("notify subscribers", async () => {
      const post = await fetchPost(this.env, postId);
      if (
        !post ||
        post.status !== "published" ||
        post.visibility !== "public" ||
        !post.publishedAt ||
        post.publishedAt > new Date()
      )
        return;
      const contentHash = await calculatePostHash({
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
      await SubscriptionService.notifySubscribersOfNewPost(
        { db: getDb(this.env), env: this.env },
        { id: post.id, title: post.title, slug: post.slug, contentHash },
      );
    });
  }
}
