import type { JSONContent } from "@tiptap/react";
import * as CacheService from "@/features/cache/cache.service";
import * as EdgeCacheService from "@/features/cache/edge-cache.service";
import { isSuperAdmin } from "@/lib/auth/access";
import { err, ok, type Result } from "@/lib/errors";
import { purgeCDNCache } from "@/lib/invalidate";
import * as MomentRepo from "./data/moments.data";
import type {
  CreateMomentInput,
  DeleteMomentInput,
  GetPublicMomentsPageInput,
  ToggleMomentLikeInput,
  UpdateMomentInput,
} from "./moments.schema";
import {
  MOMENTS_CACHE_KEYS,
  MomentsPageResponseSchema,
} from "./moments.schema";

// ============ Public Methods ============

export async function getPublicMomentsPage(
  context: DbContext & { executionCtx: ExecutionContext },
  input: GetPublicMomentsPageInput,
) {
  const { offset, limit } = input;

  const fetcher = async () => {
    const [moments, total] = await Promise.all([
      MomentRepo.getAllMoments(context.db, { offset, limit }),
      MomentRepo.countAllMoments(context.db),
    ]);

    const momentIds = moments.map((m) => m.id);
    const [likeCounts, commentCounts] = await Promise.all([
      MomentRepo.countMomentLikesForIds(context.db, momentIds),
      MomentRepo.countMomentCommentsForIds(context.db, momentIds),
    ]);

    const authorUserIds = moments.map((m) => m.authorUserId);
    const authorMap = await MomentRepo.getAuthorMap(context.db, authorUserIds);

    const items = moments.map((moment) => ({
      ...moment,
      author: moment.authorUserId
        ? (authorMap[moment.authorUserId] ?? null)
        : null,
      likeCount: likeCounts[moment.id] ?? 0,
      commentCount: commentCounts[moment.id] ?? 0,
      isLiked: false,
    }));

    return {
      items,
      total,
      offset,
      limit,
      hasNextPage: offset + items.length < total,
      hasPrevPage: offset > 0,
    };
  };

  // 5 分钟 TTL + 每次翻页组合都是独立键，KV 写入消耗高 —— 数据本体
  // 改存 Cache API（免费），版本指针仍走 KV 以保留发布即失效的语义
  return await EdgeCacheService.getVersionedJson(
    context,
    "moments:page",
    (version) => MOMENTS_CACHE_KEYS.publicPage(version, offset, limit),
    MomentsPageResponseSchema,
    fetcher,
    { ttl: "5m" },
  );
}

/**
 * 轮换动态页缓存 generation 并清理 CDN。
 * 同步 await（而非 waitUntil）：确保客户端在收到变更响应后立即
 * refetch 就能读到新 generation 的数据，消除"发布后要等几分钟
 * 再刷新才可见"的竞态。
 */
async function invalidateCache(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  await Promise.all([
    CacheService.bumpVersion(context, "moments:page"),
    purgeCDNCache(context.env, {
      urls: ["/moments"],
    }),
  ]);
}

// ============ Admin Methods ============

function stripImageNodes(content: JSONContent | null): JSONContent | null {
  if (!content) return content;
  const walk = (node: JSONContent): JSONContent | null => {
    if (node.type === "image") return null;
    if (node.content) {
      const filtered = node.content.map(walk).filter(Boolean) as JSONContent[];
      return { ...node, content: filtered };
    }
    return node;
  };
  return walk(content);
}

export async function createMoment(
  context: DbContext & { executionCtx: ExecutionContext } & AuthContext,
  data: CreateMomentInput,
) {
  const content = stripImageNodes(data.content as JSONContent | null);

  const moment = await MomentRepo.insertMoment(context.db, {
    content,
    images: data.images,
    authorUserId: context.session.user.id,
  });

  await invalidateCache(context);

  return ok(moment);
}

export async function updateMoment(
  context: DbContext & { executionCtx: ExecutionContext } & AuthContext,
  data: UpdateMomentInput,
) {
  const moment = await MomentRepo.findMomentById(context.db, data.id);
  if (!moment) {
    return err({ reason: "NOT_FOUND" });
  }

  if (
    !isSuperAdmin(context.session.user, context.env) &&
    moment.authorUserId !== context.session.user.id
  ) {
    return err({ reason: "PERMISSION_DENIED" });
  }

  const content = stripImageNodes(data.content as JSONContent | null);

  const updated = await MomentRepo.updateMoment(context.db, data.id, {
    content,
    images: data.images,
  });

  await invalidateCache(context);

  return ok(updated);
}

export async function deleteMoment(
  context: DbContext & { executionCtx: ExecutionContext } & AuthContext,
  data: DeleteMomentInput,
) {
  const moment = await MomentRepo.findMomentById(context.db, data.id);
  if (!moment) {
    return err({ reason: "NOT_FOUND" });
  }

  if (
    !isSuperAdmin(context.session.user, context.env) &&
    moment.authorUserId !== context.session.user.id
  ) {
    return err({ reason: "PERMISSION_DENIED" });
  }

  await MomentRepo.deleteMoment(context.db, data.id);
  await invalidateCache(context);

  return ok({ success: true });
}

// ============ Authed User Methods ============

export async function toggleMomentLike(
  context: DbContext & { executionCtx: ExecutionContext } & AuthContext,
  data: ToggleMomentLikeInput,
): Promise<
  Result<{ liked: boolean; likeCount: number }, { reason: "NOT_FOUND" }>
> {
  const moment = await MomentRepo.findMomentById(context.db, data.momentId);
  if (!moment) {
    return err({ reason: "NOT_FOUND" });
  }

  const userId = context.session.user.id;
  const existing = await MomentRepo.findMomentLike(
    context.db,
    data.momentId,
    userId,
  );

  if (existing) {
    await MomentRepo.deleteMomentLike(context.db, data.momentId, userId);
  } else {
    await MomentRepo.insertMomentLike(context.db, data.momentId, userId);
  }

  const likeCounts = await MomentRepo.countMomentLikesForIds(context.db, [
    data.momentId,
  ]);

  // 点赞不再轮换缓存 generation：高频互动若每次都写 KV + Purge 会
  // 快速耗尽配额。点赞数对其他访客在边缘 TTL（约 5 分钟）内自然收敛，
  // 操作者本人通过响应即时拿到最新计数。

  return ok({
    liked: !existing,
    likeCount: likeCounts[data.momentId] ?? 0,
  });
}
