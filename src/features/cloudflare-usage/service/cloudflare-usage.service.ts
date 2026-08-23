import * as CacheService from "@/features/cache/cache.service";
import {
  CF_FREE_TIER_LIMITS,
  CF_SERVICE_ORDER,
  CF_USAGE_CACHE_KEYS,
  thresholdForService,
  CfUsageDataSchema,
  type CfService,
  type CfUsageData,
  type CfServiceUsage,
} from "@/features/cloudflare-usage/cloudflare-usage.schema";
import { fetchAllUsage } from "@/features/cloudflare-usage/lib/cf-graphql";
import * as ConfigService from "@/features/config/service/config.service";

// ── 格式化单位 ───────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── 用量结果映射 ─────────────────────────────────────────────

function toServiceUsage(result: {
  service: CfService;
  used: number;
  error?: string;
}): CfServiceUsage {
  const limitInfo = CF_FREE_TIER_LIMITS[result.service];
  const percentage =
    limitInfo.limit > 0
      ? Math.min((result.used / limitInfo.limit) * 100, 100)
      : 0;

  return {
    service: result.service,
    displayName: result.service,
    used: result.used,
    limit: limitInfo.limit,
    unit: limitInfo.unit,
    percentage,
    billingMetric: limitInfo.metric,
    error: result.error,
  };
}

/** 把 fetchAllUsage 原始结果映射为带免费额度百分比的用量列表（按展示顺序排序） */
export function mapUsageToServices(
  results: Array<{
    service: CfService;
    used: number;
    error?: string;
  }>,
): CfServiceUsage[] {
  const services = results.map(toServiceUsage);
  services.sort(
    (a, b) =>
      CF_SERVICE_ORDER.indexOf(
        a.service as (typeof CF_SERVICE_ORDER)[number],
      ) -
      CF_SERVICE_ORDER.indexOf(
        b.service as (typeof CF_SERVICE_ORDER)[number],
      ),
  );
  return services;
}

// ── 获取用量数据 ─────────────────────────────────────────────
export async function getCloudflareUsage(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<CfUsageData> {
  const config = await ConfigService.getSystemConfig(context);
  const ca = config.cloudflareAnalytics;
  const accountId = context.env.CLOUDFLARE_ACCOUNT_ID ?? "";

  if (!accountId || !ca?.apiToken) {
    return {
      services: [],
      fetchedAt: Date.now(),
      period: "today",
    };
  }

  const fetcher = async (): Promise<CfUsageData> => {
    const apiToken = ca!.apiToken!;
    const env = context.env;
    // 与 Cloudflare 告警邮件同口径：今日用量 vs 每日免费额度
    const results = await fetchAllUsage(
      env,
      accountId,
      apiToken,
      "today",
    );

    return {
      services: mapUsageToServices(results),
      fetchedAt: Date.now(),
      period: "today",
    };
  };

  return CacheService.get(
    context,
    CF_USAGE_CACHE_KEYS.usage,
    CfUsageDataSchema,
    fetcher,
    { ttl: "1h" },
  );
}

/**
 * 强制刷新：删除服务端缓存后重新拉取 Cloudflare Analytics。
 * 供仪表盘「刷新」按钮使用，绕过最长 1 小时的 KV 缓存。
 */
export async function refreshCloudflareUsage(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<CfUsageData> {
  await CacheService.deleteKey(context, CF_USAGE_CACHE_KEYS.usage);
  return getCloudflareUsage(context);
}

// ── 获取告警状态 ─────────────────────────────────────────────
export async function getCloudflareAlertStatus(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const usage = await getCloudflareUsage(context);
  const config = await ConfigService.getSystemConfig(context);
  const thresholds = config.cloudflareAnalytics?.alert?.thresholds;

  if (!thresholds || !config.cloudflareAnalytics?.alert?.enabled) {
    return { alerts: [], checkedAt: Date.now() };
  }

  const alerts: Array<{
    service: string;
    displayName: string;
    metric: string;
    used: number;
    limit: number;
    percentage: number;
    threshold: number;
  }> = [];

  for (const svc of usage.services) {
    const threshold = thresholdForService(thresholds, svc.service);
    if (threshold !== undefined && svc.percentage >= threshold) {
      alerts.push({
        service: svc.service,
        displayName: svc.displayName,
        metric: svc.billingMetric ?? svc.service,
        used: svc.used,
        limit: svc.limit,
        percentage: svc.percentage,
        threshold,
      });
    }
  }

  return { alerts, checkedAt: Date.now() };
}

export { formatBytes, formatNumber };
