import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { NOTIFICATION_EVENT } from "@/features/notification/notification.schema";
import { listTelegramChats } from "@/features/webhook/api/telegram";
import { sendWebhookRequest } from "@/features/webhook/api/webhook.consumer";
import {
  createNotificationExampleEvent,
  getWebhookExampleLabel,
} from "@/features/webhook/webhook.helpers";
import { missingWebhookField } from "@/features/webhook/webhook.providers";
import { webhookEndpointSchema } from "@/features/webhook/webhook.schema";
import { serverEnv } from "@/lib/env/server.env";
import { superAdminMiddleware } from "@/lib/middlewares";

const testWebhookInputSchema = z.object({
  endpoint: webhookEndpointSchema,
});

export const testWebhookFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(testWebhookInputSchema)
  .handler(async ({ context, data }) => {
    const missing = missingWebhookField(data.endpoint);
    if (missing) {
      throw new Error(`Webhook configuration is incomplete: ${missing}`);
    }
    const resolvedEventType =
      data.endpoint.events.length > 0
        ? data.endpoint.events[0]
        : NOTIFICATION_EVENT.COMMENT_ADMIN_ROOT_CREATED;
    const locale = serverEnv(context.env).LOCALE;

    await sendWebhookRequest(
      { env: context.env },
      {
        endpointId: data.endpoint.id,
        type: data.endpoint.type ?? "generic",
        url: data.endpoint.url,
        secret: data.endpoint.secret,
        botToken: data.endpoint.botToken,
        chatId: data.endpoint.chatId,
        template: data.endpoint.template,
        event: createNotificationExampleEvent(resolvedEventType, (k) =>
          getWebhookExampleLabel(k, { locale }),
        ),
      },
      crypto.randomUUID(),
      {
        isTest: true,
      },
    );

    return {
      success: true,
    };
  });

export const listTelegramChatsFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(z.object({ token: z.string().trim().min(1).max(512) }))
  .handler(async ({ data }) => await listTelegramChats(data.token));
