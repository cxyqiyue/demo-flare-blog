import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { toUTCMidnight } from "@/features/posts/utils/date";
import {
  fetchPost,
  invalidatePostCaches,
  upsertPostSearchIndex,
} from "@/features/posts/workflows/helpers";
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
      const result = await upsertPostSearchIndex(this.env, post);
      if (result.flushPromise) {
        this.ctx.waitUntil(result.flushPromise);
      }
    });

    await step.do("notify subscribers", async () => {
      if (post.visibility !== "public") return;
      await SubscriptionService.notifySubscribersOfNewPost(
        { db: getDb(this.env), env: this.env },
        { id: post.id, title: post.title, slug: post.slug },
      );
    });
  }
}
