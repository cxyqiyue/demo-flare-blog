import * as CacheService from "@/features/cache/cache.service";
import {
  CF_FREE_TIER_LIMITS,
  CF_USAGE_CACHE_KEYS,
  type CfServiceUsage,
} from "@/features/cloudflare-usage/cloudflare-usage.schema";
import { fetchAllUsage } from "@/features/cloudflare-usage/lib/cf-graphql";
import * as ConfigService from "@/features/config/service/config.service";
import { sendEmail } from "@/features/email/service/email.service";
import { NOTIFICATION_EVENT } from "@/features/notification/notification.schema";
import { sendWebhookRequest } from "@/features/webhook/api/webhook.consumer";
import { getDb } from "@/lib/db";
import { serverEnv } from "@/lib/env/server.env";
import {
  type CfAlertRow,
  type CfAlertState,
  computeAlertRows,
  renderUsageAlertContent,
  resolveAlertsToSend,
  shouldDispatchUsageAlerts,
} from "./cloudflare-usage-alerts.utils";

// ── Cloudflare 用量定时告警（调度入口） ─────────────────────
// 由 Worker cron trigger（见 wrangler 配置 triggers.crons）每小时触发：
// 拉取今日用量 → 与阈值比对 → 按 KV 去重状态发送邮件/webhook 通知。
// 去重规则：每服务每自然日只发一次；当日从超阈值档位升档（如 80%→100%）
// 会再次发送，回落不重发。纯逻辑见 ./cloudflare-usage-alerts.utils.ts。

export type {
  CfAlertLevel,
  CfAlertRow,
  CfAlertState,
  CfAlertStateEntry,
} from "./cloudflare-usage-alerts.utils";
export {
  computeAlertRows,
  renderUsageAlertContent,
  resolveAlertsToSend,
  shouldDispatchUsageAlerts,
} from "./cloudflare-usage-alerts.utils";

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * scheduled 处理器调用：检查用量阈值并分发邮件/webhook 告警。
 * 所有失败仅记录日志，绝不抛出（避免 cron 反复重试风暴）。
 */
export async function checkAndDispatchUsageAlerts(
  env: Env,
  executionCtx: ExecutionContext,
): Promise<void> {
  try {
    const context = { env, db: getDb(env), executionCtx };
    const config = await ConfigService.getSystemConfig(context);
    const ca = config.cloudflareAnalytics;
    const accountId = env.CLOUDFLARE_ACCOUNT_ID ?? "";

    // 门控只看「启用用量告警」开关（后台设置中唯一暴露的开关）：
    // 旧代码还要求 cloudflareAnalytics.enabled，但该字段无任何 UI 写入
    // 路径且默认 false，导致定时告警从未真正执行。
    if (!shouldDispatchUsageAlerts(ca, accountId)) {
      return;
    }

    // 绕过 KV 用量缓存，取实时数据
    const results = await fetchAllUsage(env, accountId, ca.apiToken, "today");
    const services = results.map((result) => {
      const limitInfo = CF_FREE_TIER_LIMITS[result.service];
      const percentage =
        limitInfo.limit > 0
          ? Math.min((result.used / limitInfo.limit) * 100, 100)
          : 0;
      return {
        ...result,
        displayName: result.service,
        limit: limitInfo.limit,
        unit: limitInfo.unit,
        percentage,
        billingMetric: limitInfo.metric,
      } satisfies CfServiceUsage;
    });

    const alerts = computeAlertRows(services, ca.alert.thresholds);
    if (alerts.length === 0) return;

    const day = todayUtc();
    const raw = await CacheService.getRaw(
      context,
      CF_USAGE_CACHE_KEYS.alertState,
    );
    let state: CfAlertState | null = null;
    try {
      state = raw ? (JSON.parse(raw) as CfAlertState) : null;
    } catch {
      state = null;
    }

    const {
      toSend,
      nextState,
    }: {
      toSend: CfAlertRow[];
      nextState: CfAlertState;
    } = resolveAlertsToSend(alerts, state, day);

    // 状态无变化时跳过写入：超阈值日每小时都会跑到这里，
    // 重复写同一份去重状态会白白消耗 KV 写入配额
    if (JSON.stringify(nextState) !== JSON.stringify(state ?? {})) {
      executionCtx.waitUntil(
        CacheService.set(
          context,
          CF_USAGE_CACHE_KEYS.alertState,
          JSON.stringify(nextState),
        ),
      );
    }

    if (toSend.length === 0) return;

    const { LOCALE, ADMIN_EMAIL } = serverEnv(env);
    const locale: "zh" | "en" = LOCALE === "zh" ? "zh" : "en";
    const content = renderUsageAlertContent(locale, toSend);

    if (ca.alert.emailEnabled !== false && ADMIN_EMAIL) {
      try {
        await sendEmail(context, {
          to: ADMIN_EMAIL,
          subject: content.subject,
          html: content.html,
        });
      } catch (error) {
        console.error(
          JSON.stringify({
            message: "cloudflare usage alert email failed",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    if (ca.alert.webhookEnabled !== false) {
      const webhooks = config.notification?.webhooks ?? [];
      for (const endpoint of webhooks.filter((w) => w.enabled)) {
        try {
          await sendWebhookRequest(
            { env },
            {
              endpointId: endpoint.id,
              type: endpoint.type ?? "generic",
              url: endpoint.url,
              secret: endpoint.secret,
              event: {
                type: NOTIFICATION_EVENT.CLOUDFLARE_USAGE_ALERT,
                data: {
                  subject: content.subject,
                  message: content.message,
                  html: content.html,
                },
              },
            },
            crypto.randomUUID(),
          );
        } catch (error) {
          console.error(
            JSON.stringify({
              message: "cloudflare usage alert webhook failed",
              endpoint: endpoint.id,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "cloudflare usage alert check failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
