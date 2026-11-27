import { eq } from "drizzle-orm";
import {
  createAuthTestContext,
  createMockSession,
  createTestContext,
  seedUser,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as CacheService from "@/features/cache/cache.service";
import { DASHBOARD_CACHE_KEYS } from "@/features/dashboard/dashboard.schema";
import * as DashboardRepo from "@/features/dashboard/data/dashboard.data";
import * as DashboardService from "@/features/dashboard/service/dashboard.service";
import {
  CommentsTable,
  MomentsTable,
  PageViewsTable,
  PostsTable,
  type PostVisibility,
} from "@/lib/db/schema";

describe("Dashboard author access integration", () => {
  let owner: ReturnType<typeof createAuthTestContext>;
  let other: ReturnType<typeof createAuthTestContext>;
  let superAdmin: ReturnType<typeof createAuthTestContext>;

  beforeEach(async () => {
    const context = (
      id: string,
      email: string,
      role: "admin" | null = "admin",
    ) =>
      createAuthTestContext({
        session: createMockSession({ user: { id, email, role } }),
      });
    owner = context("dashboard-owner", "owner@example.com");
    other = context("dashboard-other", "other@example.com");
    // Super-admin permission is derived from configured email, not the role flag.
    superAdmin = context("dashboard-super", "admin@example.com", null);
    for (const ctx of [owner, other, superAdmin]) {
      await seedUser(ctx.db, ctx.session.user);
    }
  });

  async function fixture() {
    const base = Date.now() - 120_000;
    async function post(
      title: string,
      authorId: string | null,
      visibility: PostVisibility,
      status: "draft" | "published" = "published",
      offset = 0,
    ) {
      const [row] = await owner.db
        .insert(PostsTable)
        .values({
          title,
          slug: title.toLowerCase().replaceAll(" ", "-"),
          authorId,
          visibility,
          status,
          publishedAt: status === "published" ? new Date(base + offset) : null,
        })
        .returning();
      return row;
    }
    const ownPost = await post("Own private", owner.session.user.id, "private");
    const ownDraft = await post(
      "Own draft",
      owner.session.user.id,
      "private",
      "draft",
    );
    const otherPrivate = await post(
      "Other private",
      other.session.user.id,
      "private",
      "published",
      1000,
    );
    const otherPassword = await post(
      "Other password",
      other.session.user.id,
      "password",
      "published",
      2000,
    );
    const otherPublic = await post(
      "Other public",
      other.session.user.id,
      "public",
      "published",
      3000,
    );
    const otherDraft = await post(
      "Other draft",
      other.session.user.id,
      "private",
      "draft",
    );
    const unowned = await post(
      "Unowned private",
      null,
      "private",
      "published",
      4000,
    );
    const commentPosts = [
      ownPost,
      otherPrivate,
      otherPassword,
      otherDraft,
      unowned,
    ];
    const comments = await owner.db
      .insert(CommentsTable)
      .values(
        commentPosts.map((p, i) => ({
          postId: p.id,
          userId: other.session.user.id,
          status: "pending" as const,
          content: { type: "doc" },
          createdAt: new Date(base + i * 1000),
        })),
      )
      .returning();
    const [moment] = await owner.db
      .insert(MomentsTable)
      .values({ authorUserId: other.session.user.id })
      .returning();
    const [momentComment] = await owner.db
      .insert(CommentsTable)
      .values({
        momentId: moment.id,
        userId: other.session.user.id,
        status: "pending",
        content: { type: "doc" },
        createdAt: new Date(base - 1000),
      })
      .returning();
    await owner.db.insert(PageViewsTable).values([
      ...[
        ownPost,
        ownPost,
        otherPrivate,
        otherPrivate,
        otherPrivate,
        otherPassword,
        otherPublic,
        otherDraft,
        unowned,
      ].map((p, i) => ({
        postId: p.id,
        visitorHash: p.id === ownPost.id ? "owner-visitor" : `visitor-${i}`,
        createdAt: new Date(base + 30_000),
      })),
    ]);
    return { ownPost, ownDraft, otherPrivate, comments, momentComment };
  }

  it("filters counts and activity SQL before limits while retaining non-Post comments", async () => {
    const f = await fixture();
    const authorId = owner.session.user.id;
    expect(await DashboardRepo.getPublishedPostsCount(owner.db, authorId)).toBe(
      1,
    );
    expect(await DashboardRepo.getDraftsCount(owner.db, authorId)).toBe(1);
    expect(
      await DashboardRepo.getPendingCommentsCount(owner.db, authorId),
    ).toBe(2);
    expect(await DashboardRepo.getRecentPosts(owner.db, 1, authorId)).toEqual([
      expect.objectContaining({ id: f.ownPost.id }),
    ]);
    const limited = await DashboardRepo.getRecentComments(
      owner.db,
      1,
      authorId,
    );
    expect(limited.map((c) => c.comments.id)).toEqual([f.comments[0].id]);
    const comments = await DashboardRepo.getRecentComments(
      owner.db,
      10,
      authorId,
    );
    expect(comments.map((c) => c.comments.id).sort()).toEqual(
      [f.comments[0].id, f.momentComment.id].sort(),
    );
    const startAt = new Date(Date.now() - 3600_000);
    const endAt = new Date();
    expect(
      await DashboardRepo.getTopPages(owner.db, startAt, endAt, 1, authorId),
    ).toEqual([{ slug: f.ownPost.slug, title: f.ownPost.title, views: 2 }]);
  });

  it("never serves full-access or legacy traffic cache to a role admin", async () => {
    const f = await fixture();
    const all = await DashboardService.getDashboardStats(superAdmin);
    await waitForBackgroundTasks(superAdmin.executionCtx);
    expect(
      await CacheService.getRaw(superAdmin, DASHBOARD_CACHE_KEYS.traffic),
    ).not.toBeNull();
    await CacheService.set(
      superAdmin,
      ["dashboard", "traffic"],
      JSON.stringify(all.trafficByRange),
    );
    const getCache = vi.spyOn(CacheService, "get");
    const result = await DashboardService.getDashboardStats(owner);
    expect(getCache).not.toHaveBeenCalled();
    expect(result.stats).toMatchObject({
      publishedPosts: 1,
      drafts: 1,
      pendingComments: 2,
    });
    for (const range of Object.values(result.trafficByRange)) {
      expect(range.topPages).toEqual([
        { slug: f.ownPost.slug, title: f.ownPost.title, views: 2 },
      ]);
      expect(range.overview).toMatchObject({
        pageViews: { value: 2 },
        visitors: { value: 1 },
      });
      expect(range.traffic.reduce((sum, row) => sum + row.views, 0)).toBe(2);
    }
    expect(
      result.activities.some(
        (a) =>
          a.type === "comment" &&
          a.link?.startsWith(`/post/${f.ownPost.slug}?`),
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Other private");
    expect(JSON.stringify(result)).not.toContain("other-password");
    expect(JSON.stringify(result)).not.toContain("unowned-private");
  });

  it.each([
    "super-admin",
    "internal MCP",
  ] as const)("preserves full-site scope for %s", async (identity) => {
    const f = await fixture();
    const context =
      identity === "super-admin" ? superAdmin : createTestContext();
    const result = await DashboardService.getDashboardStats(context);
    expect(result.stats).toMatchObject({
      publishedPosts: 5,
      drafts: 2,
      pendingComments: 6,
    });
    expect(result.trafficByRange["24h"].overview?.pageViews.value).toBe(9);
    expect(result.trafficByRange["24h"].topPages).toContainEqual({
      slug: f.otherPrivate.slug,
      title: f.otherPrivate.title,
      views: 3,
    });
    expect(
      result.activities.some(
        (a) =>
          "link" in a &&
          a.link.startsWith(`/post/${f.otherPrivate.slug}?`),
      ),
    ).toBe(true);
  });

  it("immediately revokes activity and traffic metadata after Post reassignment", async () => {
    const f = await fixture();
    expect(
      (await DashboardService.getDashboardStats(owner)).trafficByRange["24h"]
        .topPages,
    ).toHaveLength(1);
    await owner.db
      .update(PostsTable)
      .set({ authorId: other.session.user.id })
      .where(eq(PostsTable.id, f.ownPost.id));
    const result = await DashboardService.getDashboardStats(owner);
    expect(result.stats).toMatchObject({
      publishedPosts: 0,
      drafts: 1,
      pendingComments: 1,
    });
    expect(result.trafficByRange["24h"].topPages).toEqual([]);
    expect(result.trafficByRange["24h"].overview?.pageViews.value).toBe(0);
    expect(JSON.stringify(result)).not.toContain(f.ownPost.slug);
    expect(JSON.stringify(result)).not.toContain(f.ownPost.title);
  });
});
