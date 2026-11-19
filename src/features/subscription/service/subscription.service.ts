import type { JSONContent } from "@tiptap/react";
import { blogConfig } from "@/blog.config";
import type { SubscriptionConfig } from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import { resolveSystemConfig } from "@/features/config/service/config.service";
import { convertToPlainText } from "@/features/posts/utils/content";
import { serverEnv } from "@/lib/env/server.env";
import { err, ok } from "@/lib/errors";
import { m } from "@/paraglide/messages";
import * as SubscriptionData from "../data/subscription.data";
import type {
  BlogSubscriptionStatus,
  ToggleBlogSubscriptionInput,
} from "../subscription.schema";
import { renderSubscriptionEmail } from "../utils/template";

export async function getSubscriptionStatus(
  context: DbContext & { session: Session },
): Promise<BlogSubscriptionStatus> {
  const row = await SubscriptionData.getBlogSubscription(
    context.db,
    context.session.user.id,
  );
  return {
    available: SubscriptionData.hasUsableEmail(context.session.user.email),
    subscribed: !!row,
  };
}

export async function toggleSubscription(
  context: DbContext & { session: Session },
  input: ToggleBlogSubscriptionInput,
) {
  const userId = context.session.user.id;

  if (
    input.enabled &&
    !SubscriptionData.hasUsableEmail(context.session.user.email)
  ) {
    return err({ reason: "SUBSCRIPTION_REQUIRES_EMAIL" });
  }

  await SubscriptionData.setBlogSubscription(context.db, userId, input.enabled);
  return ok({ success: true, subscribed: input.enabled });
}

interface NotifiablePost {
  id: number;
  title: string;
  slug: string;
  contentHash?: string;
}

const QUEUE_BATCH_SIZE = 10;

export async function notifySubscribersOfNewPost(
  context: DbContext,
  post: NotifiablePost,
) {
  const contentHash =
    post.contentHash ??
    (await hashContent({ title: post.title, slug: post.slug }));
  return notifySubscribers(context, {
    id: post.id,
    contentHash,
    contentType: "article",
    title: post.title,
    url: `https://${serverEnv(context.env).DOMAIN}/post/${encodeURIComponent(post.slug)}`,
    preview: "",
  });
}

export async function notifySubscribersOfUpdatedMoment(
  context: DbContext,
  moment: {
    id: number;
    content: JSONContent | null;
    images: string[];
    videoUrl: string | null;
  },
) {
  const contentHash = await hashContent({
    content: moment.content,
    images: moment.images,
    videoUrl: moment.videoUrl,
  });
  const preview = convertToPlainText(moment.content)
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  const { DOMAIN, LOCALE } = serverEnv(context.env);

  return notifySubscribers(context, {
    id: moment.id,
    contentHash,
    contentType: "moment",
    title: m.subscription_email_moment_title({}, { locale: LOCALE }),
    url: `https://${DOMAIN}/moments?momentId=${moment.id}#moment-${moment.id}`,
    preview,
  });
}

interface NotifiableContent {
  id: number;
  contentHash: string;
  contentType: "article" | "moment";
  title: string;
  url: string;
  preview: string;
}

async function notifySubscribers(
  context: DbContext,
  content: NotifiableContent,
) {
  const config = resolveSystemConfig(
    await ConfigRepo.getSystemConfig(context.db),
  );
  const subscriptionConfig: SubscriptionConfig | undefined =
    config?.subscription;
  const allUsers = subscriptionConfig?.allUserNotifyEnabled ?? false;

  const isCurrentNotification =
    content.contentType === "article"
      ? await SubscriptionData.isPostNotificationCurrent(
          context.db,
          content.id,
          content.contentHash,
        )
      : await SubscriptionData.isMomentNotificationCurrent(
          context.db,
          content.id,
          content.contentHash,
        );
  if (isCurrentNotification) {
    console.log(
      JSON.stringify({
        event: "blog_subscription_notify_skipped",
        reason: "already_notified",
        contentId: content.id,
        contentType: content.contentType,
      }),
    );
    return ok({ recipients: 0, skipped: true });
  }

  const recipients = await SubscriptionData.listNotificationRecipients(
    context.db,
    { allUsers },
  );

  let sentCount = 0;

  if (recipients.length > 0) {
    const { LOCALE } = serverEnv(context.env);
    const siteName = config?.site?.title?.trim() || blogConfig.title;
    const contentType =
      content.contentType === "article"
        ? m.subscription_content_type_article({}, { locale: LOCALE })
        : m.subscription_content_type_moment({}, { locale: LOCALE });

    const { subject, html } = renderSubscriptionEmail({
      config: subscriptionConfig,
      vars: {
        contentType,
        contentTitle: content.title,
        contentUrl: content.url,
        contentPreview: content.preview,
        articleTitle: content.title,
        articleUrl: content.url,
        siteName,
      },
      fallbackSubject:
        content.contentType === "article"
          ? m.subscription_email_default_subject(
              { siteName },
              { locale: LOCALE },
            )
          : m.subscription_email_moment_default_subject(
              { siteName },
              { locale: LOCALE },
            ),
      fallbackBodyHtml:
        content.contentType === "article"
          ? buildFallbackBodyHtml(content.title, siteName, LOCALE)
          : buildMomentFallbackBodyHtml(content.preview, siteName, LOCALE),
    });

    for (let i = 0; i < recipients.length; i += QUEUE_BATCH_SIZE) {
      const batch = recipients.slice(i, i + QUEUE_BATCH_SIZE);
      await Promise.all(
        batch.map((recipient) =>
          context.env.QUEUE.send({
            type: "EMAIL",
            data: {
              to: recipient.email,
              subject,
              html,
            },
          }),
        ),
      );
      sentCount += batch.length;
    }
  }

  if (content.contentType === "article") {
    await SubscriptionData.markPostNotified(
      context.db,
      content.id,
      content.contentHash,
    );
  } else {
    await SubscriptionData.markMomentNotified(
      context.db,
      content.id,
      content.contentHash,
    );
  }

  console.log(
    JSON.stringify({
      event: "blog_subscription_notify",
      contentId: content.id,
      contentType: content.contentType,
      mode: allUsers ? "all_users" : "subscribers_only",
      recipients: sentCount,
    }),
  );

  return ok({ recipients: sentCount, skipped: false });
}

async function hashContent(content: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(content)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function buildFallbackBodyHtml(
  articleTitle: string,
  siteName: string,
  locale: "zh" | "en",
): string {
  const heading = m.subscription_email_default_heading({}, { locale });
  const body = m.subscription_email_default_body(
    { articleTitle, siteName },
    { locale },
  );
  return [
    `<h2 style="margin:0 0 12px;font-size:18px;color:#222;">${heading}</h2>`,
    `<p style="margin:0;">${body}</p>`,
  ].join("");
}

function buildMomentFallbackBodyHtml(
  preview: string,
  siteName: string,
  locale: "zh" | "en",
): string {
  const heading = m.subscription_email_moment_default_heading({}, { locale });
  const body = m.subscription_email_moment_default_body(
    { siteName },
    { locale },
  );
  const previewHtml = preview
    ? `<p style="margin:12px 0 0;white-space:pre-wrap;">${escapeHtml(preview)}</p>`
    : "";
  return [
    `<h2 style="margin:0 0 12px;font-size:18px;color:#222;">${heading}</h2>`,
    `<p style="margin:0;">${body}</p>`,
    previewHtml,
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
