import { z } from "zod";

// ── Cloudflare 服务 Quota 定义 ──────────────────────────────
export const CF_SERVICES = [
  "workers",
  "d1",
  "r2",
  "kv",
  "kvWrites",
  "kvStorage",
  "queues",
  "workflows",
  "workersAi",
  "durableObjects",
] as const;

export type CfService = (typeof CF_SERVICES)[number];

// ── 单个服务用量数据 ─────────────────────────────────────────
export const CfServiceUsageSchema = z.object({
  service: z.string(),
  displayName: z.string(),
  used: z.number(),
  limit: z.number(),
  unit: z.string(),
  percentage: z.number().min(0).max(100),
  billingMetric: z.string().optional(),
  /** 该服务查询失败的原因；存在时 used=0 不可信，UI 应显示不可用 */
  error: z.string().optional(),
});
export type CfServiceUsage = z.infer<typeof CfServiceUsageSchema>;

// ── 全部用量数据 ─────────────────────────────────────────────
export const CfUsageDataSchema = z.object({
  services: z.array(CfServiceUsageSchema),
  fetchedAt: z.number(),
  period: z.string(),
});
export type CfUsageData = z.infer<typeof CfUsageDataSchema>;

// ── 告警阈值配置 ─────────────────────────────────────────────
export const CfAlertThresholdsSchema = z.object({
  workersRequestsPct: z.number().min(0).max(100).default(80),
  workersCpuPct: z.number().min(0).max(100).default(80),
  d1RowsReadPct: z.number().min(0).max(100).default(80),
  r2StoragePct: z.number().min(0).max(100).default(80),
  kvReadPct: z.number().min(0).max(100).default(80),
  kvWritePct: z.number().min(0).max(100).default(80),
  kvStoragePct: z.number().min(0).max(100).default(80),
  queuesMessagesPct: z.number().min(0).max(100).default(80),
  workflowsInvocationsPct: z.number().min(0).max(100).default(80),
  workersAiPct: z.number().min(0).max(100).default(80),
  durableObjectsRequestsPct: z.number().min(0).max(100).default(80),
});

// ── 告警状态 ─────────────────────────────────────────────────
export const CfAlertStatusSchema = z.object({
  alerts: z.array(
    z.object({
      service: z.string(),
      displayName: z.string(),
      metric: z.string(),
      used: z.number(),
      limit: z.number(),
      percentage: z.number(),
      threshold: z.number(),
    }),
  ),
  checkedAt: z.number(),
});
export type CfAlertStatus = z.infer<typeof CfAlertStatusSchema>;

// ── 测试连接输入 ─────────────────────────────────────────────
export const TestCloudflareConnectionInputSchema = z.object({
  apiToken: z.string(),
});

// ── 缓存 Key ────────────────────────────────────────────────
export const CF_USAGE_CACHE_KEYS = {
  usage: ["cloudflare-usage", "data"] as const,
  alert: ["cloudflare-usage", "alert"] as const,
  /** 定时告警去重状态（每服务当日已发送的最高档位） */
  alertState: ["cloudflare-usage", "alert-state"] as const,
} as const;

/**
 * 服务对应的告警阈值（百分比）。纯函数，供告警状态展示与定时分发共用。
 */
export function thresholdForService(
  thresholds:
    | {
        workersRequestsPct?: number;
        workersCpuPct?: number;
        d1RowsReadPct?: number;
        r2StoragePct?: number;
        kvReadPct?: number;
        kvWritePct?: number;
        kvStoragePct?: number;
        queuesMessagesPct?: number;
        workflowsInvocationsPct?: number;
        workersAiPct?: number;
        durableObjectsRequestsPct?: number;
      }
    | undefined,
  service: string,
): number | undefined {
  if (!thresholds) return undefined;
  switch (service) {
    case "workers":
      return thresholds.workersRequestsPct;
    case "d1":
      return thresholds.d1RowsReadPct;
    case "r2":
      return thresholds.r2StoragePct;
    case "kv":
      return thresholds.kvReadPct;
    case "kvWrites":
      return thresholds.kvWritePct;
    case "kvStorage":
      return thresholds.kvStoragePct;
    case "queues":
      return thresholds.queuesMessagesPct;
    case "workflows":
      return thresholds.workflowsInvocationsPct;
    case "workersAi":
      return thresholds.workersAiPct;
    case "durableObjects":
      return thresholds.durableObjectsRequestsPct;
    default:
      return undefined;
  }
}

// ── 服务显示顺序 ─────────────────────────────────────────────
export const CF_SERVICE_ORDER: CfService[] = [
  "workers",
  "d1",
  "r2",
  "kv",
  "kvWrites",
  "kvStorage",
  "queues",
  "workflows",
  "workersAi",
  "durableObjects",
];

// ── 各服务在本博客中的用途说明 ───────────────────────────────
export const CF_SERVICE_DESCRIPTIONS: Record<CfService, string> = {
  workers: "Worker 请求数：页面、API、图片代理等所有入站请求都计入",
  d1: "D1 数据库行读取：文章、评论、配置等数据库查询量",
  r2: "R2 对象存储占用：R2 原生图床存储的图片容量",
  kv: "KV 读取次数：缓存命中、会话等键值读取",
  kvWrites: "KV 写入次数：缓存写入、状态更新等键值写入",
  kvStorage: "KV 存储容量：键值数据总量（按日峰值计）",
  queues: "Queues 队列消息数：邮件发送、Webhook 推送等异步任务",
  workflows: "Workflows 调用次数：导入导出、定时发布等工作流执行",
  workersAi: "Workers AI 推理量（Neurons）：图片审查等 AI 功能消耗",
  durableObjects: "Durable Objects 请求：限流器、密码哈希等 DO 调用",
};

// ── 服务默认限制 (Free Tier) ─────────────────────────────────
export const CF_FREE_TIER_LIMITS: Record<
  CfService,
  { limit: number; unit: string; metric: string }
> = {
  workers: {
    limit: 100_000,
    unit: "requests/day",
    metric: "Requests",
  },
  d1: {
    limit: 5_000_000,
    unit: "rows read/day",
    metric: "Rows Read",
  },
  r2: {
    limit: 10 * 1024 * 1024 * 1024,
    unit: "bytes",
    metric: "Storage",
  },
  kv: {
    limit: 100_000,
    unit: "reads/day",
    metric: "Reads",
  },
  kvWrites: {
    limit: 1_000,
    unit: "writes/day",
    metric: "Writes",
  },
  kvStorage: {
    limit: 1024 ** 3,
    unit: "bytes",
    metric: "Storage",
  },
  queues: {
    limit: 1_000_000,
    unit: "messages/month",
    metric: "Messages",
  },
  workflows: {
    limit: 1_000,
    unit: "invocations/month",
    metric: "Invocations",
  },
  workersAi: {
    limit: 10_000,
    unit: "neurons/day",
    metric: "Neurons",
  },
  durableObjects: {
    limit: 1_000_000,
    unit: "requests/day",
    metric: "Requests",
  },
};
