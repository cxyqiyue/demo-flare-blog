import { createServerFn } from "@tanstack/react-start";
import { sendEmail } from "@/features/email/service/email.service";
import { testCloudflareConnection } from "@/features/cloudflare-usage/lib/cf-graphql";
import {
  getCloudflareUsage,
  getCloudflareAlertStatus,
  refreshCloudflareUsage,
} from "@/features/cloudflare-usage/service/cloudflare-usage.service";
import { TestCloudflareConnectionInputSchema } from "@/features/cloudflare-usage/cloudflare-usage.schema";
import { sendWebhookRequest } from "@/features/webhook/api/webhook.consumer";
import { createNotificationExampleEvent, getWebhookExampleLabel } from "@/features/webhook/webhook.helpers";
import { NOTIFICATION_EVENT } from "@/features/notification/notification.schema";
import * as ConfigService from "@/features/config/service/config.service";
import { serverEnv } from "@/lib/env/server.env";
import { adminMiddleware, superAdminMiddleware } from "@/lib/middlewares";

export const getCloudflareUsageFn = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(({ context }) => getCloudflareUsage(context));

export const refreshCloudflareUsageFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .handler(({ context }) => refreshCloudflareUsage(context));

export const getCloudflareAlertStatusFn = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .handler(({ context }) => getCloudflareAlertStatus(context));

export const testCloudflareConnectionFn = createServerFn({
  method: "POST",
})
  .inputValidator(TestCloudflareConnectionInputSchema)
  .middleware([adminMiddleware])
  .handler(({ data, context }) =>
    testCloudflareConnection(
      context.env.CLOUDFLARE_ACCOUNT_ID ?? "",
      data.apiToken,
    ),
  );

export const testCloudflareAlertEmailFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .handler(async ({ context }) => {
    const { ADMIN_EMAIL, LOCALE } = serverEnv(context.env);
    const result = await sendEmail(context, {
      to: ADMIN_EMAIL,
      subject:
        LOCALE === "zh"
          ? "[测试] Cloudflare 用量告警邮件通知"
          : "[Test] Cloudflare Usage Alert Email",
      html:
        LOCALE === "zh"
          ? "<p>这是一封 Cloudflare 用量告警的测试邮件。如果你收到此邮件，说明邮件通知功能正常工作。</p>"
          : "<p>This is a test email for Cloudflare usage alerts. If you received this, email notifications are working correctly.</p>",
    });
    if (result.error) {
      const err = result.error;
      return { success: false, error: "message" in err ? err.message : err.reason };
    }
    return { success: true };
  });

export const testCloudflareAlertWebhookFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .handler(async ({ context }) => {
    const config = await ConfigService.getSystemConfig(context);
    const webhooks = config?.notification?.webhooks ?? [];
    const enabled = webhooks.filter((w) => w.enabled);
    if (enabled.length === 0) {
      return { success: false, error: "未配置启用的 Webhook 端点" };
    }
    const locale = serverEnv(context.env).LOCALE;
    const results: Array<{ id: string; name: string; success: boolean; error?: string }> = [];
    for (const endpoint of enabled) {
      try {
        const resolvedEventType =
          endpoint.events.length > 0
            ? endpoint.events[0]
            : NOTIFICATION_EVENT.COMMENT_ADMIN_ROOT_CREATED;
        await sendWebhookRequest(
          { env: context.env },
          {
            endpointId: endpoint.id,
            type: endpoint.type ?? "generic",
            url: endpoint.url,
            secret: endpoint.secret,
            event: createNotificationExampleEvent(resolvedEventType, (k) =>
              getWebhookExampleLabel(k, { locale }),
            ),
          },
          crypto.randomUUID(),
          { isTest: true },
        );
        results.push({ id: endpoint.id, name: endpoint.name, success: true });
      } catch (error) {
        results.push({
          id: endpoint.id,
          name: endpoint.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const allSuccess = results.every((r) => r.success);
    return { success: allSuccess, results };
  });
