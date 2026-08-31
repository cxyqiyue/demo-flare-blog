import { logPostAutoSnapshot } from "@/features/posts/services/post-auto-snapshot.logging";
import { PostAutoSnapshotThrottleTable } from "@/lib/db/schema";

export const DEFAULT_AUTO_SNAPSHOT_QUIET_WINDOW_SECONDS = 30;
export const AUTO_SNAPSHOT_QUEUE_THROTTLE_TTL = "60s";

/** 队列入队节流窗口（秒） */
const THROTTLE_WINDOW_SECONDS = 60;

export async function enqueuePostAutoSnapshot(
  context: DbContext,
  data: {
    postId: number;
    quietWindowSeconds?: number;
    source?: string;
  },
) {
  const db = context.db;
  const now = new Date();

  // 60s 节流去重：写 D1（权威，无 KV 配额限制），避免同一篇文章短时间重复入队
  let alreadyQueued = false;
  try {
    const existing = await db.query.PostAutoSnapshotThrottleTable.findFirst({
      where: (t, { eq }) => eq(t.postId, data.postId),
    });
    if (existing) {
      const ageMs = now.getTime() - existing.queuedAt.getTime();
      if (ageMs < THROTTLE_WINDOW_SECONDS * 1000) {
        alreadyQueued = true;
      }
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "check auto snapshot throttle failed",
        postId: data.postId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  if (alreadyQueued) {
    logPostAutoSnapshot(context.env, "enqueue_skipped_throttled", {
      postId: data.postId,
      throttleKey: `post:auto-snapshot:queued:${data.postId}`,
      throttleTtl: AUTO_SNAPSHOT_QUEUE_THROTTLE_TTL,
      source: data.source ?? "unknown",
    });
    return;
  }

  // 记录/刷新入队时间（D1，无需 KV）
  try {
    await db
      .insert(PostAutoSnapshotThrottleTable)
      .values({ postId: data.postId, queuedAt: now })
      .onConflictDoUpdate({
        target: [PostAutoSnapshotThrottleTable.postId],
        set: { queuedAt: now },
      })
      .run();
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "set auto snapshot throttle failed",
        postId: data.postId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  const quietWindowSeconds =
    data.quietWindowSeconds ?? DEFAULT_AUTO_SNAPSHOT_QUIET_WINDOW_SECONDS;

  await context.env.QUEUE.send({
    type: "POST_AUTO_SNAPSHOT",
    data: {
      postId: data.postId,
      quietWindowSeconds,
    },
  });

  logPostAutoSnapshot(context.env, "queue_message_sent", {
    postId: data.postId,
    throttleKey: `post:auto-snapshot:queued:${data.postId}`,
    throttleTtl: AUTO_SNAPSHOT_QUEUE_THROTTLE_TTL,
    quietWindowSeconds,
    source: data.source ?? "unknown",
  });
}
