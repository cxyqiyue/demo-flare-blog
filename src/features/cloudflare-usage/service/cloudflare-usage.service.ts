import * as CacheService from "@/features/cache/cache.service";
import {
  CF_FREE_TIER_LIMITS,
  CF_SERVICE_ORDER,
  CF_USAGE_CACHE_KEYS,
  CfUsageDataSchema,
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

// ── 获取用量数据 ─────────────────────────────────────────────
export async function getCloudflareUsage(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<CfUsageData> {
  const config = await ConfigService.getSystemConfig(context);
  const ca = config.cloudflareAnalytics;
  const accountId = context.env.CLOUDFLARE_ACCOUNT_ID ?? "";

  if (!ca?.enabled || !accountId || !ca.apiToken) {
    return {
      services: [],
      fetchedAt: Date.now(),
      period: "30d",
    };
  }

  const fetcher = async (): Promise<CfUsageData> => {
    const env = context.env;
    const results = await fetchAllUsage(
      env,
      accountId,
      ca.apiToken!,
      "30d",
    );

    const services: CfServiceUsage[] = results.map(({ service, used }) => {
      const limitInfo = CF_FREE_TIER_LIMITS[service];
      const percentage =
        limitInfo.limit > 0 ? Math.min((used / limitInfo.limit) * 100, 100) : 0;

      return {
        service,
        displayName: service,
        used,
        limit: limitInfo.limit,
        unit: limitInfo.unit,
        percentage,
        billingMetric: limitInfo.metric,
      };
    });

    // 按照 CF_SERVICE_ORDER 排序
    services.sort(
      (a, b) =>
        CF_SERVICE_ORDER.indexOf(
          a.service as (typeof CF_SERVICE_ORDER)[number],
        ) -
        CF_SERVICE_ORDER.indexOf(
          b.service as (typeof CF_SERVICE_ORDER)[number],
        ),
    );

    return {
      services,
      fetchedAt: Date.now(),
      period: "30d",
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
    let threshold: number | undefined;

    switch (svc.service) {
      case "workers":
        threshold = thresholds.workersRequestsPct;
        break;
      case "d1":
        threshold = thresholds.d1RowsReadPct;
        break;
      case "r2":
        threshold = thresholds.r2StoragePct;
        break;
      case "kv":
        threshold = thresholds.kvReadPct;
        break;
      case "queues":
        threshold = thresholds.queuesMessagesPct;
        break;
      case "workflows":
        threshold = thresholds.workflowsInvocationsPct;
        break;
      case "workersAi":
        threshold = thresholds.workersAiPct;
        break;
      case "durableObjects":
        threshold = thresholds.durableObjectsRequestsPct;
        break;
    }

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
