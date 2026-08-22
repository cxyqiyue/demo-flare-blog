import { blogConfig } from "@/blog.config";
import type { SubscriptionConfig } from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import { resolveSystemConfig } from "@/features/config/service/config.service";
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
}

const QUEUE_BATCH_SIZE = 10;

export async function notifySubscribersOfNewPost(
  context: DbContext,
  post: NotifiablePost,
) {
  const config = resolveSystemConfig(
    await ConfigRepo.getSystemConfig(context.db),
  );
  const subscriptionConfig: SubscriptionConfig | undefined =
    config?.subscription;
  const allUsers = subscriptionConfig?.allUserNotifyEnabled ?? false;

  const notified = await SubscriptionData.isPostNotified(context.db, post.id);
  if (notified) {
    console.log(
      JSON.stringify({
        event: "blog_subscription_notify_skipped",
        reason: "already_notified",
        postId: post.id,
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
    const { DOMAIN, LOCALE } = serverEnv(context.env);
    const siteName = config?.site?.title?.trim() || blogConfig.title;
    const articleUrl = `https://${DOMAIN}/post/${encodeURIComponent(post.slug)}`;

    const { subject, html } = renderSubscriptionEmail({
      config: subscriptionConfig,
      vars: {
        articleTitle: post.title,
        articleUrl,
        siteName,
      },
      fallbackSubject: m.subscription_email_default_subject(
        { siteName },
        { locale: LOCALE },
      ),
      fallbackBodyHtml: buildFallbackBodyHtml(post.title, siteName, LOCALE),
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

  await SubscriptionData.markPostNotified(context.db, post.id);

  console.log(
    JSON.stringify({
      event: "blog_subscription_notify",
      postId: post.id,
      mode: allUsers ? "all_users" : "subscribers_only",
      recipients: sentCount,
    }),
  );

  return ok({ recipients: sentCount, skipped: false });
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
