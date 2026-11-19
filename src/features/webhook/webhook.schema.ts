import { z } from "zod";
import type { NotificationEvent } from "@/features/notification/notification.schema";
import { ADMIN_NOTIFICATION_EVENTS } from "@/features/notification/notification.schema";
import type { Messages } from "@/lib/i18n";

export const NOTIFICATION_WEBHOOK_EVENTS = ADMIN_NOTIFICATION_EVENTS;

export const notificationWebhookEventTypeSchema = z.enum(
  NOTIFICATION_WEBHOOK_EVENTS,
);

export type NotificationWebhookEventType =
  (typeof NOTIFICATION_WEBHOOK_EVENTS)[number];

export function isNotificationWebhookEventType(
  event: NotificationEvent,
): event is Extract<
  NotificationEvent,
  { type: (typeof NOTIFICATION_WEBHOOK_EVENTS)[number] }
> {
  return NOTIFICATION_WEBHOOK_EVENTS.some((type) => type === event.type);
}

export const WEBHOOK_TYPES = [
  "generic",
  "telegram",
  "discord",
  "feishu",
  "dingtalk",
  "wecom",
  "bark",
  "ntfy",
  "custom",
] as const;

export const webhookTypeSchema = z.enum(WEBHOOK_TYPES);
export type WebhookType = z.infer<typeof webhookTypeSchema>;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const webhookEndpointSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    type: webhookTypeSchema.optional(),
    url: z.string(),
    enabled: z.boolean(),
    secret: z.string().optional(),
    botToken: z.string().optional(),
    chatId: z.string().trim().max(100).optional(),
    template: z.string().max(4000).optional(),
    events: z.array(notificationWebhookEventTypeSchema),
  })
  .superRefine((endpoint, ctx) => {
    const provider = endpoint.type ?? "generic";
    if (provider !== "telegram" && !isHttpUrl(endpoint.url.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "A valid HTTP or HTTPS URL is required",
      });
    }
    if (provider === "telegram") {
      if (!endpoint.botToken?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["botToken"],
          message: "A Telegram bot token is required",
        });
      }
      if (!endpoint.chatId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chatId"],
          message: "A Telegram chat ID is required",
        });
      }
    }
    if (provider === "generic" && !endpoint.secret?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secret"],
        message: "A signing secret is required for generic webhooks",
      });
    }
    if (provider === "custom" && !endpoint.template?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["template"],
        message: "A request body template is required",
      });
    }
  });

export function createWebhookEndpointFormSchema(messages: Messages) {
  return z
    .object({
      id: z.string(),
      name: z.string().min(1),
      type: webhookTypeSchema.optional(),
      url: z.string(),
      enabled: z.boolean(),
      secret: z.string().optional(),
      botToken: z.string().optional(),
      chatId: z.string().trim().max(100).optional(),
      template: z.string().max(4000).optional(),
      events: z.array(notificationWebhookEventTypeSchema),
    })
    .superRefine((endpoint, ctx) => {
      const provider = endpoint.type ?? "generic";
      if (provider !== "telegram" && !isHttpUrl(endpoint.url.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["url"],
          message: messages.settings_webhook_url_required(),
        });
      }
      if (provider === "generic" && !endpoint.secret?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["secret"],
          message: messages.settings_webhook_secret_required(),
        });
      }
      if (provider === "telegram" && !endpoint.botToken?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["botToken"],
          message: messages.settings_webhook_bot_token_required(),
        });
      }
      if (provider === "telegram" && !endpoint.chatId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chatId"],
          message: messages.settings_webhook_chat_id_required(),
        });
      }
      if (provider === "custom" && !endpoint.template?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["template"],
          message: messages.settings_webhook_template_required(),
        });
      }
    });
}
