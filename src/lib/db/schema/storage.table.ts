import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createdAt, id, updatedAt } from "./helper";

/**
 * 存储降级相关的 D1 表。
 * 用途：当 KV 写入达到免费限额（或管理员关闭 KV）时，作为 KV 的降级后端，
 * 保证博客所有功能都能在 D1 之上继续正常工作。
 */

/** 搜索索引（Orama）分片存储：KV 降级时替代 search:index:* KV 键 */
export const SearchIndexShardsTable = sqliteTable(
  "search_index_shards",
  {
    id,
    shardKey: text("shard_key").notNull(),
    shardIndex: integer("shard_index").notNull(),
    data: text("data").notNull(),
    updatedAt,
  },
  (table) => [
    uniqueIndex("search_index_shards_key_idx").on(
      table.shardKey,
      table.shardIndex,
    ),
  ],
);

/** ALTCHA 一次性挑战防重放：KV 降级时替代 challenge:used:* KV 键 */
export const UsedChallengesTable = sqliteTable(
  "used_challenges",
  {
    challenge: text("challenge").primaryKey().notNull(),
    usedAt: integer("used_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("used_challenges_used_at_idx").on(table.usedAt)],
);

/** KV 每日写入限额状态（单例，id=1）：持久化跨 Worker 重启 */
export const KvRateLimitStateTable = sqliteTable(
  "kv_rate_limit_state",
  {
    id: integer("id")
      .primaryKey({ autoIncrement: true })
      .notNull(),
    dailyWriteCount: integer("daily_write_count").notNull().default(0),
    lastWriteDate: text("last_write_date").notNull(),
    autoDisabled: integer("auto_disabled", { mode: "boolean" })
      .notNull()
      .default(false),
    restoredAt: integer("restored_at", { mode: "timestamp" }),
    updatedAt,
  },
  (table) => [check("kv_rate_limit_state_id_singleton", sql`${table.id} = 1`)],
);

/** 导入/导出任务进度：KV 降级时替代 export:progress:* / import:progress:* KV 键 */
export const TaskProgressTable = sqliteTable(
  "task_progress",
  {
    taskId: text("task_id").primaryKey().notNull(),
    type: text("type").notNull(),
    progressJson: text("progress_json").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("task_progress_type_idx").on(table.type)],
);

/** Cloudflare 用量告警去重状态：KV 降级时替代 cloudflare-usage alert-state KV 键 */
export const CfAlertStateTable = sqliteTable(
  "cf_alert_state",
  {
    id,
    day: text("day").notNull(),
    stateJson: text("state_json").notNull(),
    updatedAt,
  },
  (table) => [uniqueIndex("cf_alert_state_day_idx").on(table.day)],
);

/** 自动快照节流标记：KV 降级时替代 post:auto-snapshot:queued:* KV 键 */
export const PostAutoSnapshotThrottleTable = sqliteTable(
  "post_auto_snapshot_throttle",
  {
    postId: integer("post_id").primaryKey().notNull(),
    queuedAt: integer("queued_at", { mode: "timestamp" }).notNull(),
    createdAt,
    updatedAt,
  },
);

/** 存储事件审计日志（可选）：记录降级 / 手动开关 / 恢复等操作 */
export const StorageLogTable = sqliteTable(
  "storage_log",
  {
    id,
    event: text("event").notNull(),
    detailJson: text("detail_json"),
    createdAt,
  },
  (table) => [
    index("storage_log_created_idx").on(table.createdAt),
    index("storage_log_event_idx").on(table.event),
  ],
);
