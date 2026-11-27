import {
  createAuthTestContext,
  createMockSession,
  createTestContext,
  seedUser,
} from "tests/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import * as CommentService from "@/features/comments/comments.service";
import * as CommentRepo from "@/features/comments/data/comments.data";
import {
  AboutArticleTable,
  MomentsTable,
  PostsTable,
  type PostVisibility,
} from "@/lib/db/schema";

const content = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Own comment" }] },
  ],
};

const postCases: {
  label: string;
  visibility: PostVisibility;
  status: "published" | "draft";
}[] = [
  { label: "public", visibility: "public", status: "published" },
  { label: "private", visibility: "private", status: "published" },
  { label: "password", visibility: "password", status: "published" },
  { label: "draft", visibility: "public", status: "draft" },
];

describe("Comment management Post ownership", () => {
  let manager: ReturnType<typeof createAuthTestContext>;
  let other: ReturnType<typeof createAuthTestContext>;
  let superAdmin: ReturnType<typeof createAuthTestContext>;

  beforeEach(async () => {
    manager = createAuthTestContext({
      session: createMockSession({
        user: {
          id: "comment-manager",
          email: "manager@example.com",
          name: "Comment Manager",
          role: "admin",
        },
      }),
    });
    other = createAuthTestContext({
      session: createMockSession({
        user: { id: "other-author", email: "other@example.com", role: "admin" },
      }),
    });
    superAdmin = createAuthTestContext({
      session: createMockSession({
        user: { id: "comment-super", email: "admin@example.com", role: null },
      }),
    });
    for (const context of [manager, other, superAdmin]) {
      await seedUser(context.db, context.session.user);
    }
  });

  async function fixture(
    authorId: string | null,
    postCase = postCases[0],
    options: { status?: "published" | "pending"; createdAt?: Date } = {},
  ) {
    const [post] = await manager.db
      .insert(PostsTable)
      .values({
        title: `Confidential ${crypto.randomUUID()}`,
        slug: `secret-${crypto.randomUUID()}`,
        authorId,
        visibility: postCase.visibility,
        status: postCase.status,
        passwordHash:
          postCase.visibility === "password" ? "protected-hash" : null,
        publishedAt: postCase.status === "published" ? new Date() : null,
      })
      .returning();
    const comment = await CommentRepo.insertComment(manager.db, {
      postId: post.id,
      // Owning the comment must never grant management access to its Post.
      userId: manager.session.user.id,
      content,
      status: options.status ?? "published",
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    });
    return { post, comment };
  }

  it.each(
    postCases,
  )("scopes $label Post comments and totals to their author", async (postCase) => {
    const own = await fixture(manager.session.user.id, postCase);
    const hidden = await fixture(other.session.user.id, postCase);
    const result = await CommentService.getAllComments(manager, {});
    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: own.comment.id,
        post: { title: own.post.title, slug: own.post.slug },
      }),
    ]);
    expect(
      await CommentService.getAllComments(manager, { postId: hidden.post.id }),
    ).toEqual({ items: [], total: 0 });
    const ownerResult = await CommentService.getAllComments(other, {
      postId: hidden.post.id,
    });
    expect(ownerResult.total).toBe(1);
    expect(ownerResult.items[0].id).toBe(hidden.comment.id);
  });

  it("filters before pagination and returns the scoped total on empty pages", async () => {
    const own = await fixture(manager.session.user.id, postCases[1], {
      createdAt: new Date(1000),
    });
    await fixture(other.session.user.id, postCases[2], {
      createdAt: new Date(2000),
    });
    const first = await CommentService.getAllComments(manager, {
      limit: 1,
      offset: 0,
    });
    expect(first.total).toBe(1);
    expect(first.items.map((item) => item.id)).toEqual([own.comment.id]);
    expect(
      await CommentService.getAllComments(manager, { limit: 1, offset: 1 }),
    ).toEqual({ items: [], total: 1 });
  });

  it("intersects owner scope with user, name and status filters for both queries", async () => {
    const own = await fixture(manager.session.user.id, postCases[1], {
      status: "pending",
    });
    await fixture(manager.session.user.id, postCases[0]);
    await fixture(other.session.user.id, postCases[2], { status: "pending" });
    const result = await CommentService.getAllComments(manager, {
      userId: manager.session.user.id,
      userName: "Comment Manager",
      status: "pending",
    });
    expect(result.total).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual([own.comment.id]);
    expect(
      await CommentService.getAllComments(manager, {
        userName: "No such user",
      }),
    ).toEqual({ items: [], total: 0 });
  });

  it("allows the super admin full management access regardless of database role", async () => {
    const fixtures = [];
    for (const postCase of postCases)
      fixtures.push(await fixture(other.session.user.id, postCase));
    const result = await CommentService.getAllComments(superAdmin, {});
    expect(result.total).toBe(fixtures.length);
    expect(result.items.map((item) => item.id).sort((a, b) => a - b)).toEqual(
      fixtures.map(({ comment }) => comment.id).sort((a, b) => a - b),
    );
  });

  it("does not treat unassigned Posts as owned by an ordinary admin", async () => {
    const { post, comment } = await fixture(null, postCases[1]);
    expect(
      await CommentService.getAllComments(manager, { postId: post.id }),
    ).toEqual({ items: [], total: 0 });
    const result = await CommentService.getAllComments(superAdmin, {
      postId: post.id,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(comment.id);
  });

  it("preserves full access for sessionless internal management callers", async () => {
    const { post, comment } = await fixture(
      other.session.user.id,
      postCases[1],
    );
    const result = await CommentService.getAllComments(createTestContext(), {
      postId: post.id,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(comment.id);
  });

  it("retains global Moment and About comments without a Post author", async () => {
    await fixture(other.session.user.id, postCases[1]);
    const [moment] = await manager.db
      .insert(MomentsTable)
      .values({})
      .returning();
    const [about] = await manager.db
      .insert(AboutArticleTable)
      .values({ title: "About", markdown: "About content" })
      .returning();
    const momentComment = await CommentRepo.insertComment(manager.db, {
      momentId: moment.id,
      content,
      status: "published",
    });
    const aboutComment = await CommentRepo.insertComment(manager.db, {
      aboutArticleId: about.id,
      content,
      status: "published",
    });
    const result = await CommentService.getAllComments(manager, {});
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id).sort((a, b) => a - b)).toEqual(
      [momentComment.id, aboutComment.id].sort((a, b) => a - b),
    );
    expect(
      (await CommentService.getAllComments(manager, { momentId: moment.id }))
        .total,
    ).toBe(1);
    expect(
      (
        await CommentService.getAllComments(manager, {
          aboutArticleId: about.id,
        })
      ).total,
    ).toBe(1);
  });

  it.each(
    postCases.slice(1),
  )("keeps my own comment on an inaccessible $label Post without Post metadata", async (postCase) => {
    const { post, comment } = await fixture(other.session.user.id, postCase);
    const mine = await CommentService.getMyComments(manager, {});
    expect(mine).toEqual([
      expect.objectContaining({ id: comment.id, postId: post.id, content }),
    ]);
    expect(mine[0]).not.toHaveProperty("post");
    expect(mine[0]).not.toHaveProperty("postTitle");
    expect(mine[0]).not.toHaveProperty("postSlug");
    expect(JSON.stringify(mine)).not.toContain(post.title);
    expect(JSON.stringify(mine)).not.toContain(post.slug);
  });
});
