import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ConfigRepo from "@/features/config/data/config.data";
import { DEFAULT_CONFIG } from "@/features/config/config.schema";
import * as SubscriptionService from "@/features/subscription/service/subscription.service";
import { BlogSubscriptionsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  createAdminTestContext,
  createAuthTestContext,
  seedUser,
} from "tests/test-utils";

const POST = { id: 101, title: "Hello World", slug: "hello-world" };

function getEnqueuedRecipients(context: ReturnType<typeof createAdminTestContext>) {
  return vi.mocked(context.env.QUEUE.send).mock.calls.map(
    (call) => (call[0] as { data: { to: string } }).data.to,
  );
}

describe("SubscriptionService", () => {
  let context: ReturnType<typeof createAdminTestContext>;

  const USERS = [
    { id: "u1", name: "Subscribed User", email: "u1@example.org", role: null },
    { id: "u2", name: "Plain User", email: "u2@example.org", role: null },
    {
      id: "u3",
      name: "Banned Subscriber",
      email: "u3@example.org",
      role: null,
      banned: true,
      banReason: "spam",
    },
    {
      id: "u4",
      name: "Temp Banned Subscriber",
      email: "u4@example.org",
      role: null,
      banned: false,
      banExpires: new Date(Date.now() + 86_400_000),
    },
    {
      id: "u5",
      name: "Placeholder Email Subscriber",
      email: "u5@better-auth.local",
      role: null,
    },
  ];

  async function seedSubscription(userId: string) {
    await context.db
      .insert(BlogSubscriptionsTable)
      .values({ userId })
      .onConflictDoNothing();
  }

  async function seedSubscriptionConfig(subscription: Record<string, unknown>) {
    await ConfigRepo.upsertSystemConfig(context.db, {
      ...DEFAULT_CONFIG,
      subscription,
    } as typeof DEFAULT_CONFIG);
  }

  beforeEach(async () => {
    context = createAdminTestContext();
    await seedUser(context.db, context.session.user);
    for (const user of USERS) {
      await seedUser(context.db, user);
    }
    await seedSubscription("u1");
    await seedSubscription("u3");
    await seedSubscription("u4");
    await seedSubscription("u5");
  });

  describe("notifySubscribersOfNewPost", () => {
    it("notifies only subscribed users by default", async () => {
      const result = await SubscriptionService.notifySubscribersOfNewPost(
        context,
        POST,
      );

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ recipients: 1, skipped: false });
      expect(getEnqueuedRecipients(context)).toEqual(["u1@example.org"]);
    });

    it("marks the post notified and never sends twice", async () => {
      await SubscriptionService.notifySubscribersOfNewPost(context, POST);

      const second =
        await SubscriptionService.notifySubscribersOfNewPost(context, POST);

      expect(second.data).toEqual({ recipients: 0, skipped: true });
      expect(getEnqueuedRecipients(context)).toHaveLength(1);
    });

    it("all-user mode overrides individual preferences but still excludes banned and placeholder emails", async () => {
      await seedSubscriptionConfig({ allUserNotifyEnabled: true });

      const result = await SubscriptionService.notifySubscribersOfNewPost(
        context,
        POST,
      );

      expect(result.error).toBeNull();
      const recipients = getEnqueuedRecipients(context).sort();
      expect(recipients).toEqual([
        "admin@example.com",
        "u1@example.org",
        "u2@example.org",
      ]);
    });

    it("renders the mandatory article title and link into every email", async () => {
      await SubscriptionService.notifySubscribersOfNewPost(context, POST);

      const firstCall = vi.mocked(context.env.QUEUE.send).mock.calls[0][0] as {
        data: { subject: string; html: string };
      };
      expect(firstCall.data.subject).toContain("Hello World");
      expect(firstCall.data.html).toContain("https://example.com/post/hello-world");
      expect(firstCall.data.html).toContain("Hello World");
    });

    it("uses the custom admin template while still appending the mandatory block", async () => {
      await seedSubscriptionConfig({
        templateSubject: "Custom subject without title",
        templateBody: "<p>Custom body without link</p>",
      });

      await SubscriptionService.notifySubscribersOfNewPost(context, POST);

      const firstCall = vi.mocked(context.env.QUEUE.send).mock.calls[0][0] as {
        data: { subject: string; html: string };
      };
      expect(firstCall.data.subject).toContain("Custom subject without title");
      expect(firstCall.data.html).toContain("<p>Custom body without link</p>");
      expect(firstCall.data.html).toContain(
        'href="https://example.com/post/hello-world"',
      );
    });
  });

  describe("getSubscriptionStatus / toggleSubscription", () => {
    it("defaults to unsubscribed and toggles on/off", async () => {
      const userContext = createAuthTestContext();
      await seedUser(userContext.db, userContext.session.user);

      const initial =
        await SubscriptionService.getSubscriptionStatus(userContext);
      expect(initial).toEqual({ available: true, subscribed: false });

      const enabled = await SubscriptionService.toggleSubscription(
        userContext,
        { enabled: true },
      );
      expect(enabled.error).toBeNull();

      const afterEnable =
        await SubscriptionService.getSubscriptionStatus(userContext);
      expect(afterEnable.subscribed).toBe(true);

      const disabled = await SubscriptionService.toggleSubscription(
        userContext,
        { enabled: false },
      );
      expect(disabled.error).toBeNull();

      const afterDisable =
        await SubscriptionService.getSubscriptionStatus(userContext);
      expect(afterDisable.subscribed).toBe(false);
    });

    it("refuses to enable subscription for accounts without a usable email", async () => {
      const noEmailContext = createAuthTestContext();
      noEmailContext.session.user.email = "ghost@better-auth.local";

      const status =
        await SubscriptionService.getSubscriptionStatus(noEmailContext);
      expect(status.available).toBe(false);

      const result = await SubscriptionService.toggleSubscription(
        noEmailContext,
        { enabled: true },
      );
      expect(result.error?.reason).toBe("SUBSCRIPTION_REQUIRES_EMAIL");

      const rows = await context.db
        .select()
        .from(BlogSubscriptionsTable)
        .where(eq(BlogSubscriptionsTable.userId, "test-user-id"));
      expect(rows).toHaveLength(0);
    });
  });
});
