import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { KvRateLimitStateTable, StorageLogTable } from "@/lib/db/schema";

/**
 * KV 写入保护层（KVWriteGuard）。
 *
 * 背景：Cloudflare KV 免费额度限制为每天 1000 次写入；D1 无写入限制。
 * 目的：在 KV 写入接近限额（或管理员明确关闭 KV）时自动跳过 KV 写入，
 * 由各功能模块回退到 D1，保证博客功能永不因 KV 写入配额耗尽而中断。
 *
 * 本模块自建 getDb(env)，不依赖调用方是否拥有 db 上下文（BaseContext 即可），
 * 因此所有现有 KV 写入调用点无需改动签名即可接入。
 */

/** KV 每日写入安全阈值（预留 100 次余量，避开 1000 次硬限制） */
export const KV_WRITE_SAFE_LIMIT = 900;

/** 读取 storage.kvEnabled（直接查 D1，避免与 ConfigService 循环依赖） */
export async function isKvEnabledByConfig(env: Env): Promise<boolean> {
  try {
    const db = getDb(env);
    const row = await db.query.SystemConfigTable.findFirst({
      columns: { configJson: true },
    });
    return row?.configJson?.storage?.kvEnabled ?? true;
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "read storage config failed, defaulting to kv enabled",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return true;
  }
}

export interface KvWriteDecision {
  allowed: boolean;
  count: number;
  autoDisabled: boolean;
  userDisabled: boolean;
}

/**
 * 获取当日 KV 写入状态。
 * 跨日时自动重置计数并恢复 KV（自动恢复策略）。
 */
export async function getKvWriteState(env: Env): Promise<KvWriteDecision> {
  const db = getDb(env);
  const today = todayUtc();
  const userDisabled = !(await isKvEnabledByConfig(env));

  let row;
  try {
    row = await db.query.KvRateLimitStateTable.findFirst();
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "read kv rate limit state failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  // 跨日自动恢复
  if (row && row.lastWriteDate !== today) {
    const wasAutoDisabled = !!row.autoDisabled;
    try {
      await db
        .update(KvRateLimitStateTable)
        .set({
          dailyWriteCount: 0,
          autoDisabled: false,
          lastWriteDate: today,
          restoredAt: new Date(),
        })
        .where(eq(KvRateLimitStateTable.id, 1))
        .run();
      if (wasAutoDisabled) {
        await logStorageEvent(env, "kv_auto_restored", { date: today });
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          message: "kv rate limit daily reset failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const count = row?.dailyWriteCount ?? 0;
  const autoDisabled = !!row?.autoDisabled;

  return {
    allowed: !userDisabled && !autoDisabled && count < KV_WRITE_SAFE_LIMIT,
    count,
    autoDisabled,
    userDisabled,
  };
}

/**
 * 受保护的 KV 写入。
 * @returns true = 已写入 KV；false = 被拦截/降级
 */
export async function guardedKvPut(
  env: Env,
  key: string,
  value: string | ArrayBuffer | Uint8Array,
  options?: KVNamespacePutOptions,
): Promise<boolean> {
  const state = await getKvWriteState(env);

  if (!state.allowed) {
    if (
      !state.autoDisabled &&
      !state.userDisabled &&
      state.count >= KV_WRITE_SAFE_LIMIT
    ) {
      await setAutoDisabled(env, true, state.count);
    }
    return false;
  }

  try {
    await env.KV.put(key, value, options);
    await incrementDailyCount(env, state.count);
    return true;
  } catch (err) {
    if (isRateLimitError(err)) {
      await setAutoDisabled(env, true, state.count);
    }
    return false;
  }
}

/** KV 删除不受写入配额限制，直接执行 */
export async function guardedKvDelete(
  env: Env,
  key: string,
): Promise<boolean> {
  try {
    await env.KV.delete(key);
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "cache delete failed",
        key,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}

/** 手动启用 KV（后台打开开关时调用） */
export async function enableKv(env: Env): Promise<void> {
  await ensureStateRow(env);
  const db = getDb(env);
  try {
    await db
      .update(KvRateLimitStateTable)
      .set({
        autoDisabled: false,
        dailyWriteCount: 0,
        lastWriteDate: todayUtc(),
        restoredAt: new Date(),
      })
      .where(eq(KvRateLimitStateTable.id, 1))
      .run();
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "enable kv state update failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  await logStorageEvent(env, "kv_manual_enabled", {});
}

/** 手动禁用 KV（后台关闭开关时调用） */
export async function disableKv(env: Env): Promise<void> {
  await logStorageEvent(env, "kv_manual_disabled", {});
}

/** 自动禁用 KV（达到写入阈值或写入报错） */
async function setAutoDisabled(
  env: Env,
  disabled: boolean,
  count: number,
): Promise<void> {
  await ensureStateRow(env);
  const db = getDb(env);
  try {
    await db
      .update(KvRateLimitStateTable)
      .set({ autoDisabled: disabled })
      .where(eq(KvRateLimitStateTable.id, 1))
      .run();
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "set auto disabled failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  await logStorageEvent(env, disabled ? "kv_auto_disabled" : "kv_auto_enabled", {
    count,
    limit: KV_WRITE_SAFE_LIMIT,
  });
}

/** 当日已用写入次数 +1 */
async function incrementDailyCount(
  env: Env,
  currentCount: number,
): Promise<void> {
  const db = getDb(env);
  const today = todayUtc();
  try {
    await ensureStateRow(env);
    // 仅在非跨日且 autoDisabled=false 时累计（避免重复计数）
    await db
      .update(KvRateLimitStateTable)
      .set({ dailyWriteCount: currentCount + 1 })
      .where(
        and(
          eq(KvRateLimitStateTable.id, 1),
          eq(KvRateLimitStateTable.lastWriteDate, today),
          eq(KvRateLimitStateTable.autoDisabled, false),
        ),
      )
      .run();
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "kv write count increment failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/** 确保单例状态行存在（id=1） */
async function ensureStateRow(env: Env): Promise<void> {
  const db = getDb(env);
  const exists = await db.query.KvRateLimitStateTable.findFirst();
  if (exists) return;
  await db
    .insert(KvRateLimitStateTable)
    .values({
      id: 1,
      dailyWriteCount: 0,
      lastWriteDate: todayUtc(),
      autoDisabled: false,
    })
    .onConflictDoNothing()
    .catch((err) =>
      console.error(
        JSON.stringify({
          message: "kv rate limit state init failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      ),
    );
}

/** 记录存储事件到审计日志（失败不影响主流程） */
export async function logStorageEvent(
  env: Env,
  event: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb(env);
    await db.insert(StorageLogTable).values({
      event,
      detailJson: detail ? JSON.stringify(detail) : null,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "storage log write failed",
        event,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

function isRateLimitError(err: unknown): boolean {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: unknown }).status)
      : 0;
  return (
    status === 429 ||
    status === 403 ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("1000") ||
    message.includes("exceeded")
  );
}
