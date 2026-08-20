import { z } from "zod";

// ── 8 Cloudflare 服务 Quota 定义 ──────────────────────────────
export const CF_SERVICES = [
  "workers",
  "d1",
  "r2",
  "kv",
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
  accountId: z.string(),
  apiToken: z.string(),
});

// ── 缓存 Key ────────────────────────────────────────────────
export const CF_USAGE_CACHE_KEYS = {
  usage: ["cloudflare-usage", "data"] as const,
  alert: ["cloudflare-usage", "alert"] as const,
} as const;

// ── 服务显示顺序 ─────────────────────────────────────────────
export const CF_SERVICE_ORDER: CfService[] = [
  "workers",
  "d1",
  "r2",
  "kv",
  "queues",
  "workflows",
  "workersAi",
  "durableObjects",
];

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
