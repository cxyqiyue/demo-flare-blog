import { createEmailMessageFromNotification } from "@/features/email/service/email-message.mapper";
import type { NotificationEvent } from "@/features/notification/notification.schema";
import { getWebhookSeverity } from "@/features/webhook/webhook.helpers";
import {
  buildWebhookRequest,
  providerOf,
  webhookResponseError,
} from "@/features/webhook/webhook.providers";
import { serverEnv } from "@/lib/env/server.env";
import type { Locale } from "@/lib/i18n";
import type { WebhookMessage } from "@/lib/queue/queue.schema";
import { m } from "@/paraglide/messages";
import { baseLocale } from "@/paraglide/runtime";

function createPlainTextMessage(event: NotificationEvent, locale: Locale) {
  switch (event.type) {
    case "comment.admin_root_created":
      return m.email_webhook_comment_admin_root_message(
        {
          commentPreview: event.data.commentPreview,
          commentUrl: event.data.commentUrl,
          commenterName: event.data.commenterName,
          postTitle: event.data.postTitle,
        },
        { locale },
      );
    case "comment.admin_pending_review":
      return m.email_webhook_comment_admin_pending_message(
        {
          commentPreview: event.data.commentPreview,
          commenterName: event.data.commenterName,
          postTitle: event.data.postTitle,
          reviewUrl: event.data.reviewUrl,
        },
        { locale },
      );
    case "comment.admin_blocked":
      return m.email_webhook_comment_admin_blocked_message(
        {
          commentPreview: event.data.commentPreview,
          commenterName: event.data.commenterName,
          postTitle: event.data.postTitle,
          reason: event.data.reason ?? "",
          reviewUrl: event.data.reviewUrl,
        },
        { locale },
      );
    case "comment.reply_to_admin_published":
    case "comment.reply_to_user_published":
      return m.email_webhook_comment_reply_message(
        {
          commentUrl: event.data.commentUrl,
          postTitle: event.data.postTitle,
          replierName: event.data.replierName,
          replyPreview: event.data.replyPreview,
        },
        { locale },
      );
    case "friend_link.submitted":
      return m.email_webhook_friend_link_submitted_message(
        {
          siteName: event.data.siteName,
          siteUrl: event.data.siteUrl,
          submitterName: event.data.submitterName,
        },
        { locale },
      );
    case "friend_link.approved":
      return m.email_webhook_friend_link_approved_message(
        { siteName: event.data.siteName },
        { locale },
      );
    case "friend_link.rejected":
      return event.data.rejectionReason
        ? m.email_webhook_friend_link_rejected_message(
            {
              rejectionReason: event.data.rejectionReason,
              siteName: event.data.siteName,
            },
            { locale },
          )
        : m.email_webhook_friend_link_rejected_message_no_reason(
            { siteName: event.data.siteName },
            { locale },
          );
    case "cloudflare.usage_alert":
      // 内容由告警服务预渲染，直接透传
      return event.data.message;
    default: {
      event satisfies never;
      throw new Error("Unknown notification event");
    }
  }
}

function createRenderedEmail(event: NotificationEvent, locale: Locale) {
  const email = createEmailMessageFromNotification(event, locale);

  return {
    subject: email.subject,
    message: createPlainTextMessage(event, locale),
    html: email.html,
  };
}

export function createWebhookBody(
  messageId: string,
  event: NotificationEvent,
  options?: {
    isTest?: boolean;
  },
  locale: Locale = baseLocale,
) {
  return {
    id: messageId,
    type: event.type,
    timestamp: new Date().toISOString(),
    source: "demo-flare-blog",
    severity: getWebhookSeverity(event.type),
    test: options?.isTest ?? false,
    data: event.data,
    ...createRenderedEmail(event, locale),
  };
}

export async function sendWebhookRequest(
  context: { env: Env },
  data: WebhookMessage["data"],
  messageId: string,
  options?: {
    isTest?: boolean;
  },
): Promise<void> {
  const locale = serverEnv(context.env).LOCALE;
  const body = createWebhookBody(messageId, data.event, options, locale);
  const { event: _event, ...endpoint } = data;
  const eventData = data.event.data;
  const url =
    "commentUrl" in eventData
      ? eventData.commentUrl
      : "reviewUrl" in eventData
        ? eventData.reviewUrl
        : "blogUrl" in eventData
          ? eventData.blogUrl
          : "siteUrl" in eventData && typeof eventData.siteUrl === "string"
            ? eventData.siteUrl
            : "";
  const request = await buildWebhookRequest(
    endpoint,
    {
      ...body,
      title: body.subject,
      message: body.message,
      url,
      data: body.data,
    },
    JSON.stringify(body),
  );
  const response = await fetch(request.url, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "demo-flare-blog/webhook", ...request.headers },
    body: request.body,
  });

  let responseText = "";
  try {
    responseText = await response.text();
  } catch {
    // Providers that do not return a body can still accept the notification.
  }
  const detail = webhookResponseError(
    providerOf(endpoint),
    response.ok,
    responseText,
  );
  if (detail !== null) {
    throw new Error(
      m.settings_webhook_delivery_failed(
        {
          detail: detail.slice(0, 1000),
          status: String(response.status),
          statusText: response.statusText,
        },
        { locale },
      ),
    );
  }
}

export async function handleWebhookMessage(
  context: { env: Env },
  data: WebhookMessage["data"],
  messageId: string,
): Promise<void> {
  await sendWebhookRequest(context, data, messageId);
}
