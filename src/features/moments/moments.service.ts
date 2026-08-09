import type { JSONContent } from "@tiptap/react";
import * as CacheService from "@/features/cache/cache.service";
import { purgeCDNCache } from "@/lib/invalidate";
import { err, ok, type Result } from "@/lib/errors";
import * as MomentRepo from "./data/moments.data";
import type {
  CreateMomentInput,
  DeleteMomentInput,
  ToggleMomentLikeInput,
} from "./moments.schema";
import { MOMENTS_CACHE_KEYS, MomentsResponseSchema } from "./moments.schema";

// ============ Public Methods ============

export async function getPublicMoments(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const fetcher = async () => {
    const moments = await MomentRepo.getAllMoments(context.db, { limit: 50 });

    const momentIds = moments.map((m) => m.id);
    const [likeCounts, commentCounts] = await Promise.all([
      MomentRepo.countMomentLikesForIds(context.db, momentIds),
      MomentRepo.countMomentCommentsForIds(context.db, momentIds),
    ]);

    const authorUserIds = moments.map((m) => m.authorUserId);
    const authorMap = await MomentRepo.getAuthorMap(context.db, authorUserIds);

    return moments.map((moment) => ({
      ...moment,
      author: moment.authorUserId
        ? authorMap[moment.authorUserId] ?? null
        : null,
      likeCount: likeCounts[moment.id] ?? 0,
      commentCount: commentCounts[moment.id] ?? 0,
      isLiked: false,
    }));
  };

  return await CacheService.getVersioned(
    context,
    "moments:list",
    MOMENTS_CACHE_KEYS.list,
    MomentsResponseSchema,
    fetcher,
    { ttl: "5m" },
  );
}

function invalidateCache(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  context.executionCtx.waitUntil(
    Promise.all([
      CacheService.bumpVersion(context, "moments:list"),
      purgeCDNCache(context.env, {
        urls: ["/moments"],
      }),
    ]),
  );
}

// ============ Admin Methods ============

export async function createMoment(
  context: DbContext & { executionCtx: ExecutionContext } & AuthContext,
  data: CreateMomentInput,
) {
  const content = data.content as JSONContent | null;

  const moment = await MomentRepo.insertMoment(context.db, {
    content,
    images: data.images,
    authorUserId: context.session.user.id,
  });

  invalidateCache(context);

  return ok(moment);
}

export async function deleteMoment(
  context: DbContext & { executionCtx: ExecutionContext },
  data: DeleteMomentInput,
) {
  const moment = await MomentRepo.findMomentById(context.db, data.id);
  if (!moment) {
    return err({ reason: "NOT_FOUND" });
  }

  await MomentRepo.deleteMoment(context.db, data.id);
  invalidateCache(context);

  return ok({ success: true });
}

// ============ Authed User Methods ============

export async function toggleMomentLike(
  context: DbContext & { executionCtx: ExecutionContext } & AuthContext,
  data: ToggleMomentLikeInput,
): Promise<
  Result<
    { liked: boolean; likeCount: number },
    { reason: "NOT_FOUND" }
  >
> {
  const moment = await MomentRepo.findMomentById(context.db, data.momentId);
  if (!moment) {
    return err({ reason: "NOT_FOUND" });
  }

  const userId = context.session.user.id;
  const existing = await MomentRepo.findMomentLike(context.db, data.momentId, userId);

  if (existing) {
    await MomentRepo.deleteMomentLike(context.db, data.momentId, userId);
  } else {
    await MomentRepo.insertMomentLike(context.db, data.momentId, userId);
  }

  const likeCounts = await MomentRepo.countMomentLikesForIds(context.db, [data.momentId]);

  invalidateCache(context);

  return ok({
    liked: !existing,
    likeCount: likeCounts[data.momentId] ?? 0,
  });
}
