import { lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  PostAutoSnapshotThrottleTable,
  StorageLogTable,
  TaskProgressTable,
  UsedChallengesTable,
} from "@/lib/db/schema";

/**
 * 存储降级相关 D1 表的定期清理。
 * 由 Worker 定时任务（cron）调用，避免无 TTL 的降级表无限增长。
 */

/** used_challenges：ALTCHA 挑战 300s TTL；保留 1 天足矣 */
const USED_CHALLENGES_KEEP_DAYS = 1;

/** task_progress：导入/导出进度 TTL 24h；保留 2 天 */
const TASK_PROGRESS_KEEP_DAYS = 2;

/** storage_log：审计日志保留 30 天 */
const STORAGE_LOG_KEEP_DAYS = 30;

/** 自动快照节流：60s 节流窗口，保留 1 天 */
const THROTTLE_KEEP_DAYS = 1;

function daysAgoUnix(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

/** 执行所有降级表的清理任务（各失败仅记录，不抛出） */
export async function cleanupStorageFallbackTables(
  env: Env,
): Promise<{ ok: boolean }> {
  const db = getDb(env);
  const tasks: Array<Promise<unknown>> = [];

  tasks.push(
    db
      .delete(UsedChallengesTable)
      .where(lt(UsedChallengesTable.usedAt, new Date(daysAgoUnix(USED_CHALLENGES_KEEP_DAYS) * 1000)))
      .run()
      .catch((err) =>
        console.error(
          JSON.stringify({
            message: "cleanup used_challenges failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        ),
      ),
  );

  tasks.push(
    db
      .delete(TaskProgressTable)
      .where(lt(TaskProgressTable.updatedAt, new Date(daysAgoUnix(TASK_PROGRESS_KEEP_DAYS) * 1000)))
      .run()
      .catch((err) =>
        console.error(
          JSON.stringify({
            message: "cleanup task_progress failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        ),
      ),
  );

  tasks.push(
    db
      .delete(StorageLogTable)
      .where(lt(StorageLogTable.createdAt, new Date(daysAgoUnix(STORAGE_LOG_KEEP_DAYS) * 1000)))
      .run()
      .catch((err) =>
        console.error(
          JSON.stringify({
            message: "cleanup storage_log failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        ),
      ),
  );

  tasks.push(
    db
      .delete(PostAutoSnapshotThrottleTable)
      .where(lt(PostAutoSnapshotThrottleTable.queuedAt, new Date(daysAgoUnix(THROTTLE_KEEP_DAYS) * 1000)))
      .run()
      .catch((err) =>
        console.error(
          JSON.stringify({
            message: "cleanup post_auto_snapshot_throttle failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        ),
      ),
  );

  // 清理孤立的搜索分片行（保留最新一份，历史冗余由写入时的事务替换负责）
  // 这里不做，由 saveIndexToD1 的事务性替换保证。

  await Promise.all(tasks);
  return { ok: true };
}
