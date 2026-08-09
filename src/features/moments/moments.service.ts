import * as CacheService from "@/features/cache/cache.service";
import { err, ok } from "@/lib/errors";
import { purgeCDNCache } from "@/lib/invalidate";
import * as MomentRepo from "./data/moments.data";
import type {
  CreateMomentInput,
  DeleteMomentInput,
  GetAllMomentsInput,
  GetMomentsInput,
  UpdateMomentInput,
} from "./moments.schema";
import { MOMENTS_CACHE_KEYS, MomentListResponseSchema } from "./moments.schema";

// ============ Public Methods ============

export async function getPublicMoments(
  context: DbContext & { executionCtx: ExecutionContext },
  data: GetMomentsInput,
) {
  const offset = data.offset ?? 0;
  const limit = data.limit ?? 20;

  const fetcher = async () => {
    const [items, total] = await Promise.all([
      MomentRepo.getMoments(context.db, { offset, limit }),
      MomentRepo.getMomentsCount(context.db),
    ]);
    return { items, total, hasNext: offset + items.length < total };
  };

  return await CacheService.getVersioned(
    context,
    "moments:list",
    (version) =>
      [...MOMENTS_CACHE_KEYS.publicList(version), offset, limit] as const,
    MomentListResponseSchema,
    fetcher,
    { ttl: "5m" },
  );
}

// ============ Admin Methods ============

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

export async function getAllMoments(
  context: DbContext,
  data: GetAllMomentsInput,
) {
  const [items, total] = await Promise.all([
    MomentRepo.getMoments(context.db, {
      offset: data.offset,
      limit: data.limit,
    }),
    MomentRepo.getMomentsCount(context.db),
  ]);

  return { items, total };
}

export async function createMoment(
  context: AuthContext & { executionCtx: ExecutionContext },
  data: CreateMomentInput,
) {
  const moment = await MomentRepo.insertMoment(context.db, {
    content: data.content,
    userId: context.session.user.id,
  });

  invalidateCache(context);

  return moment;
}

export async function updateMoment(
  context: DbContext & { executionCtx: ExecutionContext },
  data: UpdateMomentInput,
) {
  const moment = await MomentRepo.findMomentById(context.db, data.id);
  if (!moment) {
    return err({ reason: "NOT_FOUND" });
  }

  const updated = await MomentRepo.updateMoment(context.db, data.id, {
    content: data.content,
  });

  invalidateCache(context);

  return ok(updated);
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
