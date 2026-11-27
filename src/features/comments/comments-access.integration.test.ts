import { eq } from "drizzle-orm";
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
  buildUnlockCookieHeader,
  createUnlockCookieValue,
  createViewerAccess,
} from "@/features/posts/services/post-access.service";
import { hashPassword } from "@/features/posts/utils/post-secret";
import {
  CommentsTable,
  MomentsTable,
  PostsTable,
  type PostVisibility,
} from "@/lib/db/schema";
import { err, unwrap } from "@/lib/errors";

const content = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Comment access" }] },
  ],
};

type Identity =
  | "anonymous"
  | "reader"
  | "author"
  | "super"
  | "admin"
  | "unlocked";
type SignedInIdentity = Exclude<Identity, "anonymous">;

const identities: Identity[] = [
  "anonymous",
  "reader",
  "author",
  "super",
  "admin",
  "unlocked",
];
const signedInIdentities: SignedInIdentity[] = [
  "reader",
  "author",
  "super",
  "admin",
  "unlocked",
];
const visibilities: PostVisibility[] = ["public", "private", "password"];

function canRead(visibility: PostVisibility, identity: Identity) {
  return (
    visibility === "public" ||
    identity === "author" ||
    identity === "super" ||
    (visibility === "password" && identity === "unlocked")
  );
}

describe("Comment Post access integration", () => {
  let anonymous: ReturnType<typeof createTestContext>;
  let contexts: Record<
    "reader" | "author" | "super" | "admin",
    ReturnType<typeof createAuthTestContext>
  >;

  beforeEach(async () => {
    anonymous = createTestContext();
    const makeContext = (
      id: string,
      email: string,
      role: "admin" | null = null,
    ) =>
      createAuthTestContext({
        session: createMockSession({ user: { id, email, role } }),
      });
    contexts = {
      reader: makeContext("comment-reader", "reader@example.com"),
      author: makeContext("post-author", "author@example.com"),
      super: makeContext("super-user", "admin@example.com"),
      admin: makeContext("other-admin", "other-admin@example.com", "admin"),
    };
    for (const context of Object.values(contexts)) {
      await seedUser(context.db, context.session.user);
    }
  });

  async function fixture(
    visibility: PostVisibility,
    status: "published" | "draft" = "published",
  ) {
    const passwordHash = await hashPassword("comment-password");
    const [post] = await anonymous.db
      .insert(PostsTable)
      .values({
        title: "Restricted comments",
        slug: crypto.randomUUID(),
        status,
        visibility,
        authorId: contexts.author.session.user.id,
        passwordHash,
        publishedAt: status === "published" ? new Date() : null,
      })
      .returning();
    const root = await CommentRepo.insertComment(anonymous.db, {
      postId: post.id,
      userId: contexts.author.session.user.id,
      content,
      status: "published",
    });
    const reply = await CommentRepo.insertComment(anonymous.db, {
      postId: post.id,
      userId: contexts.author.session.user.id,
      rootId: root.id,
      replyToCommentId: root.id,
      content,
      status: "published",
    });
    const cookie = buildUnlockCookieHeader(
      await createUnlockCookieValue(anonymous.env, post.id, passwordHash),
    );
    return { post, root, reply, cookie };
  }

  function readContext(identity: Identity, cookie: string) {
    if (identity === "anonymous") return { ...anonymous, session: null };
    if (identity === "unlocked") {
      return {
        ...anonymous,
        viewer: createViewerAccess(anonymous.env, null, cookie),
      };
    }
    // Deliberately omit viewer to verify service callers resolve their session.
    return contexts[identity];
  }

  function writeContext(identity: SignedInIdentity, cookie: string) {
    if (identity !== "unlocked") return contexts[identity];
    return {
      ...contexts.reader,
      viewer: createViewerAccess(
        anonymous.env,
        contexts.reader.session.user,
        cookie,
      ),
    };
  }

  describe.each(visibilities)("%s Post", (visibility) => {
    it.each(
      identities,
    )("checks roots, replies and counts for %s", async (identity) => {
      const { post, root, reply, cookie } = await fixture(visibility);
      const context = readContext(identity, cookie);
      const roots = await CommentService.getRootCommentsByTarget(context, {
        postId: post.id,
      });
      const replies = await CommentService.getRepliesByRootId(context, {
        postId: post.id,
        rootId: root.id,
      });
      if (!canRead(visibility, identity)) {
        expect(roots).toEqual({ items: [], total: 0 });
        expect(replies).toEqual({ items: [], total: 0 });
        return;
      }
      expect(roots.total).toBe(1);
      expect(roots.items).toEqual([
        expect.objectContaining({ id: root.id, replyCount: 1 }),
      ]);
      expect(replies.total).toBe(1);
      expect(replies.items).toEqual([
        expect.objectContaining({ id: reply.id }),
      ]);
    });

    it.each(
      signedInIdentities,
    )("checks root and reply creation for %s", async (identity) => {
      const { post, root, cookie } = await fixture(visibility);
      const context = writeContext(identity, cookie);
      const rootResult = await CommentService.createComment(context, {
        postId: post.id,
        content,
      });
      const replyResult = await CommentService.createComment(context, {
        postId: post.id,
        rootId: root.id,
        content,
      });
      if (!canRead(visibility, identity)) {
        expect(rootResult).toEqual(err({ reason: "POST_NOT_FOUND" }));
        expect(replyResult).toEqual(err({ reason: "POST_NOT_FOUND" }));
        const stored = await anonymous.db
          .select({ id: CommentsTable.id })
          .from(CommentsTable)
          .where(eq(CommentsTable.postId, post.id));
        expect(stored).toHaveLength(2);
        expect(
          context.env.COMMENT_MODERATION_WORKFLOW.create,
        ).not.toHaveBeenCalled();
        return;
      }
      expect(unwrap(rootResult)).toMatchObject({
        postId: post.id,
        userId: context.session.user.id,
      });
      expect(unwrap(replyResult)).toMatchObject({
        postId: post.id,
        rootId: root.id,
      });
    });
  });

  it.each([
    "author",
    "super",
    "unlocked",
  ] as const)("denies draft comments even for %s", async (identity) => {
    const { post, root, cookie } = await fixture("password", "draft");
    const context = writeContext(identity, cookie);
    expect(
      await CommentService.getRootCommentsByTarget(context, {
        postId: post.id,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.getRepliesByRootId(context, {
        postId: post.id,
        rootId: root.id,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.createComment(context, { postId: post.id, content }),
    ).toEqual(err({ reason: "POST_NOT_FOUND" }));
    expect(
      await CommentService.createComment(context, {
        postId: post.id,
        rootId: root.id,
        content,
      }),
    ).toEqual(err({ reason: "POST_NOT_FOUND" }));
    expect(
      context.env.COMMENT_MODERATION_WORKFLOW.create,
    ).not.toHaveBeenCalled();
  });

  it("denies future-scheduled comments even to the author", async () => {
    const { post, root } = await fixture("public");
    await anonymous.db
      .update(PostsTable)
      .set({ publishedAt: new Date(Date.now() + 86_400_000) })
      .where(eq(PostsTable.id, post.id));
    expect(
      await CommentService.getRootCommentsByTarget(contexts.author, {
        postId: post.id,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.getRepliesByRootId(contexts.author, {
        postId: post.id,
        rootId: root.id,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.createComment(contexts.author, {
        postId: post.id,
        content,
      }),
    ).toEqual(err({ reason: "POST_NOT_FOUND" }));
  });

  it("does not trust viewerId as a Post author credential", async () => {
    const { post, root } = await fixture("private");
    const viewerId = contexts.author.session.user.id;
    expect(
      await CommentService.getRootCommentsByTarget(anonymous, {
        postId: post.id,
        viewerId,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.getRepliesByRootId(anonymous, {
        postId: post.id,
        rootId: root.id,
        viewerId,
      }),
    ).toEqual({ items: [], total: 0 });
  });

  it("checks Post access before revealing whether a thread exists", async () => {
    const { post } = await fixture("private");
    expect(
      await CommentService.createComment(contexts.reader, {
        postId: post.id,
        rootId: 999999,
        content,
      }),
    ).toEqual(err({ reason: "POST_NOT_FOUND" }));
  });

  it("rejects a token for another Post and an old password", async () => {
    const first = await fixture("password");
    const second = await fixture("password");
    const wrongPost = writeContext("unlocked", first.cookie);
    expect(
      await CommentService.getRootCommentsByTarget(wrongPost, {
        postId: second.post.id,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.getRepliesByRootId(wrongPost, {
        postId: second.post.id,
        rootId: second.root.id,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.createComment(wrongPost, {
        postId: second.post.id,
        content,
      }),
    ).toEqual(err({ reason: "POST_NOT_FOUND" }));
    await anonymous.db
      .update(PostsTable)
      .set({ passwordHash: await hashPassword("changed") })
      .where(eq(PostsTable.id, first.post.id));
    expect(
      await CommentService.getRootCommentsByTarget(wrongPost, {
        postId: first.post.id,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.createComment(wrongPost, {
        postId: first.post.id,
        rootId: first.root.id,
        content,
      }),
    ).toEqual(err({ reason: "POST_NOT_FOUND" }));
  });

  it("denies missing Posts without writes or workflow effects", async () => {
    expect(
      await CommentService.getRootCommentsByTarget(anonymous, {
        postId: 999999,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.getRepliesByRootId(anonymous, {
        postId: 999999,
        rootId: 999999,
      }),
    ).toEqual({ items: [], total: 0 });
    expect(
      await CommentService.createComment(contexts.super, {
        postId: 999999,
        content,
      }),
    ).toEqual(err({ reason: "POST_NOT_FOUND" }));
    expect(
      contexts.super.env.COMMENT_MODERATION_WORKFLOW.create,
    ).not.toHaveBeenCalled();
  });

  it("keeps moment targets readable and writable when their ID matches a private Post", async () => {
    const { post } = await fixture("private");
    const [moment] = await anonymous.db
      .insert(MomentsTable)
      .values({ id: post.id })
      .returning();
    const root = await CommentRepo.insertComment(anonymous.db, {
      momentId: moment.id,
      userId: contexts.author.session.user.id,
      content,
      status: "published",
    });
    const reply = await CommentRepo.insertComment(anonymous.db, {
      momentId: moment.id,
      userId: contexts.author.session.user.id,
      content,
      status: "published",
      rootId: root.id,
      replyToCommentId: root.id,
    });
    const roots = await CommentService.getRootCommentsByTarget(anonymous, {
      momentId: moment.id,
    });
    const replies = await CommentService.getRepliesByRootId(anonymous, {
      momentId: moment.id,
      rootId: root.id,
    });
    expect(roots.total).toBe(1);
    expect(roots.items).toEqual([
      expect.objectContaining({ id: root.id, replyCount: 1 }),
    ]);
    expect(replies.total).toBe(1);
    expect(replies.items[0].id).toBe(reply.id);
    expect(
      unwrap(
        await CommentService.createComment(contexts.reader, {
          momentId: moment.id,
          content,
        }),
      ),
    ).toMatchObject({ momentId: moment.id, postId: null });
    expect(
      unwrap(
        await CommentService.createComment(contexts.reader, {
          momentId: moment.id,
          rootId: root.id,
          content,
        }),
      ),
    ).toMatchObject({ momentId: moment.id, postId: null, rootId: root.id });
  });
});
