import { eq } from "drizzle-orm";
import {
  createAuthTestContext,
  createMockSession,
  createTestContext,
  seedUser,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as EdgeCacheService from "@/features/cache/edge-cache.service";
import * as PageviewRepo from "@/features/pageview/data/pageview.data";
import * as PageviewService from "@/features/pageview/service/pageview.service";
import {
  buildUnlockCookieHeader,
  createUnlockCookieValue,
  createViewerAccess,
} from "@/features/posts/services/post-access.service";
import {
  PageViewsTable,
  PostsTable,
  type PostVisibility,
} from "@/lib/db/schema";

const identities = [
  "anonymous",
  "reader",
  "author",
  "admin",
  "super",
  "unlocked",
] as const;
type Identity = (typeof identities)[number];
const passwordHash = "pageview-password-hash";

describe("Pageview Post access integration", () => {
  let anonymous: ReturnType<typeof createTestContext>;
  let actors: Record<
    "reader" | "author" | "admin" | "super",
    ReturnType<typeof createAuthTestContext>
  >;

  beforeEach(async () => {
    anonymous = createTestContext();
    const actor = (id: string, email: string, role: string | null = null) =>
      createAuthTestContext({
        session: createMockSession({ user: { id, email, role } }),
      });
    actors = {
      reader: actor("pageview-reader", "pageview-reader@example.com"),
      author: actor("pageview-author", "pageview-author@example.com"),
      admin: actor("pageview-admin", "pageview-admin@example.com", "admin"),
      super: actor("pageview-super", "admin@example.com"),
    };
    for (const context of Object.values(actors))
      await seedUser(context.db, context.session.user);
    vi.mocked(anonymous.env.QUEUE.send).mockClear();
  });

  async function fixture(visibility: PostVisibility = "public") {
    const [post] = await anonymous.db
      .insert(PostsTable)
      .values({
        title: "Pageview access",
        slug: crypto.randomUUID(),
        authorId: actors.author.session.user.id,
        status: "published",
        publishedAt: new Date(Date.now() - 10_000),
        visibility,
        passwordHash,
      })
      .returning();
    await anonymous.db
      .insert(PageViewsTable)
      .values({ postId: post.id, visitorHash: "existing-visitor" });
    const cookie = buildUnlockCookieHeader(
      await createUnlockCookieValue(anonymous.env, post.id, passwordHash),
    );
    return { post, cookie };
  }

  function viewer(identity: Identity, cookie: string) {
    if (identity === "anonymous") return anonymous;
    if (identity === "unlocked")
      return {
        ...anonymous,
        viewer: createViewerAccess(anonymous.env, null, cookie),
      };
    // Direct service callers must also resolve session ownership and superadmin.
    return actors[identity];
  }

  describe.each([
    "public",
    "private",
    "password",
  ] as const)("%s Post", (visibility) => {
    it.each(
      identities,
    )("checks counts and queue writes for %s", async (identity) => {
      const { post, cookie } = await fixture(visibility);
      const context = viewer(identity, cookie);
      const allowed =
        visibility === "public" ||
        identity === "author" ||
        identity === "super" ||
        (visibility === "password" && identity === "unlocked");
      expect(await PageviewService.getViewCounts(context, [post.slug])).toEqual(
        allowed ? { [post.slug]: 1 } : {},
      );
      await PageviewService.recordPageView(context, {
        postId: post.id,
        visitorHash: "new-visitor",
      });
      expect(context.env.QUEUE.send).toHaveBeenCalledTimes(allowed ? 1 : 0);
      if (allowed)
        expect(context.env.QUEUE.send).toHaveBeenCalledWith({
          type: "PAGEVIEW",
          data: { postId: post.id, visitorHash: "new-visitor" },
        });
    });
  });

  it.each([
    "draft",
    "scheduled",
    "undated",
  ] as const)("denies %s Posts even with owner, superadmin or password access", async (state) => {
    const { post, cookie } = await fixture("password");
    await anonymous.db
      .update(PostsTable)
      .set({
        status: state === "draft" ? "draft" : "published",
        publishedAt:
          state === "scheduled" ? new Date(Date.now() + 2 * 86_400_000) : null,
      })
      .where(eq(PostsTable.id, post.id));
    for (const identity of [
      "anonymous",
      "author",
      "super",
      "unlocked",
    ] as const) {
      const context = viewer(identity, cookie);
      expect(await PageviewService.getViewCounts(context, [post.slug])).toEqual(
        {},
      );
      await PageviewService.recordPageView(context, {
        postId: post.id,
        visitorHash: "denied",
      });
    }
    expect(anonymous.env.QUEUE.send).not.toHaveBeenCalled();
  });

  it("omits private, password, unpublished and missing keys from mixed count results", async () => {
    const publicPost = await fixture();
    const privatePost = await fixture("private");
    const passwordPost = await fixture("password");
    const draft = await fixture();
    await anonymous.db
      .update(PostsTable)
      .set({ status: "draft" })
      .where(eq(PostsTable.id, draft.post.id));
    const slugs = [
      publicPost.post.slug,
      privatePost.post.slug,
      passwordPost.post.slug,
      draft.post.slug,
      "missing",
    ];
    expect(await PageviewService.getViewCounts(actors.author, slugs)).toEqual({
      [publicPost.post.slug]: 1,
      [privatePost.post.slug]: 1,
      [passwordPost.post.slug]: 1,
    });
    await waitForBackgroundTasks(actors.author.executionCtx);
    expect(await PageviewService.getViewCounts(anonymous, slugs)).toEqual({
      [publicPost.post.slug]: 1,
    });
  });

  it("revokes a warmed public count immediately after the Post becomes private", async () => {
    const { post } = await fixture();
    const counts = vi.spyOn(PageviewRepo, "getViewCountsBySlugs");
    expect(await PageviewService.getViewCounts(anonymous, [post.slug])).toEqual(
      { [post.slug]: 1 },
    );
    await waitForBackgroundTasks(anonymous.executionCtx);
    await anonymous.db
      .insert(PageViewsTable)
      .values({ postId: post.id, visitorHash: "second-visitor" });
    expect(await PageviewService.getViewCounts(anonymous, [post.slug])).toEqual(
      { [post.slug]: 1 },
    );
    expect(counts).toHaveBeenCalledTimes(1);
    await anonymous.db
      .update(PostsTable)
      .set({ visibility: "private" })
      .where(eq(PostsTable.id, post.id));
    const cache = vi.spyOn(EdgeCacheService, "getJson");
    expect(await PageviewService.getViewCounts(anonymous, [post.slug])).toEqual(
      {},
    );
    expect(cache).not.toHaveBeenCalled();
    await PageviewService.recordPageView(anonymous, {
      postId: post.id,
      visitorHash: "denied",
    });
    expect(anonymous.env.QUEUE.send).not.toHaveBeenCalled();
  });

  it("rejects grants for another Post and revokes warmed counts after password rotation", async () => {
    const first = await fixture("password");
    const second = await fixture("password");
    const context = viewer("unlocked", first.cookie);
    expect(
      await PageviewService.getViewCounts(context, [second.post.slug]),
    ).toEqual({});
    await PageviewService.recordPageView(context, {
      postId: second.post.id,
      visitorHash: "wrong-post",
    });
    expect(
      await PageviewService.getViewCounts(context, [first.post.slug]),
    ).toEqual({ [first.post.slug]: 1 });
    await waitForBackgroundTasks(context.executionCtx);
    await anonymous.db
      .update(PostsTable)
      .set({ passwordHash: "rotated-password-hash" })
      .where(eq(PostsTable.id, first.post.id));
    expect(
      await PageviewService.getViewCounts(context, [first.post.slug]),
    ).toEqual({});
    await PageviewService.recordPageView(context, {
      postId: first.post.id,
      visitorHash: "old-password",
    });
    expect(anonymous.env.QUEUE.send).not.toHaveBeenCalled();
  });

  it("prunes unrelated keys from a cached payload and silently ignores a nonexistent queue target", async () => {
    const publicPost = await fixture();
    const privatePost = await fixture("private");
    vi.spyOn(EdgeCacheService, "getJson").mockResolvedValue({
      [publicPost.post.slug]: 1,
      [privatePost.post.slug]: 9,
      missing: 12,
    });
    expect(
      await PageviewService.getViewCounts(anonymous, [
        publicPost.post.slug,
        privatePost.post.slug,
      ]),
    ).toEqual({ [publicPost.post.slug]: 1 });
    await expect(
      PageviewService.recordPageView(anonymous, {
        postId: 999999,
        visitorHash: "missing",
      }),
    ).resolves.toBeUndefined();
    expect(anonymous.env.QUEUE.send).not.toHaveBeenCalled();
  });
});
