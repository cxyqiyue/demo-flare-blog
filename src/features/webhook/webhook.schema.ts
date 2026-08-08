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

export const webhookTypeSchema = z.enum(["generic", "wecom"]);

export type WebhookType = z.infer<typeof webhookTypeSchema>;

export const webhookEndpointSchema = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    type: webhookTypeSchema.optional(),
    url: z.url(),
    enabled: z.boolean(),
    secret: z.string().optional(),
    events: z.array(notificationWebhookEventTypeSchema),
  })
  .superRefine((endpoint, ctx) => {
    if (endpoint.type !== "wecom" && !endpoint.secret?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secret"],
        message: "A signing secret is required for generic webhooks",
      });
    }
  });

export function createWebhookEndpointFormSchema(messages: Messages) {
  return z
    .object({
      id: z.string(),
      name: z.string().min(1),
      type: webhookTypeSchema.optional(),
      url: z.url(),
      enabled: z.boolean(),
      secret: z.string().optional(),
      events: z.array(notificationWebhookEventTypeSchema),
    })
    .superRefine((endpoint, ctx) => {
      if (endpoint.type !== "wecom" && !endpoint.secret?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["secret"],
          message: messages.settings_webhook_secret_required(),
        });
      }
    });
}
