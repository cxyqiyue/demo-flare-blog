import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  createMockExecutionCtx,
  createMockSession,
  createTestDb,
  seedUser,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import * as RevisionService from "@/features/posts/services/post-revisions.service";
import { MediaTable, PostRevisionsTable, PostsTable } from "@/lib/db/schema";
import { unwrap } from "@/lib/errors";
import { createPermissionError } from "@/lib/errors/request-errors";

type ActorContext = DbContext & {
  session: Session;
  executionCtx: ExecutionContext;
};
type PostInsert = typeof PostsTable.$inferInsert;

const db = createTestDb();
const body = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const image = (src: string) => ({
  type: "doc",
  content: [{ type: "image", attrs: { src } }],
});
const secretBody = "RevisionHistoricalSecretBody";
const originalUrl = "https://cdn.example.net/revision-private.webp?keep=1";
let owner: ActorContext;
let otherAdmin: ActorContext;
let superAdmin: ActorContext;
let serial: number;

function actor(id: string, email: string, role = "admin"): ActorContext {
  return {
    db,
    env: { ...env, ADMIN_EMAIL: "revision-super@example.com" },
    executionCtx: createMockExecutionCtx(),
    session: createMockSession({
      user: { id, email, name: id, role },
      session: { userId: id },
    }),
  };
}

async function seedPost(options: Partial<PostInsert> = {}) {
  const [post] = await db
    .insert(PostsTable)
    .values({
      title: "RevisionHistoricalSecretTitle",
      summary: "RevisionHistoricalSecretSummary",
      slug: "revision-access-" + ++serial,
      authorId: owner.session.user.id,
      status: "draft",
      visibility: "private",
      publishedAt: new Date("2020-01-01"),
      readTimeInMinutes: 3,
      contentJson: body(secretBody),
      publicContentJson: body("PublicSnapshotMustNotLeak"),
      passwordHash: "StoredRevisionHashMustNotLeak",
      passwordCipher: "StoredRevisionCipherMustNotLeak",
      ...options,
    })
    .returning();
  return post;
}

async function createRevision(
  context: ActorContext | DbContext,
  postId: number,
) {
  const result = unwrap(
    await RevisionService.createPostRevision(context, {
      postId,
      reason: "publish",
    }),
  );
  if (!result.revision) throw new Error("Expected a persisted revision");
  return result.revision;
}

async function currentPost(postId: number) {
  return await db.query.PostsTable.findFirst({
    where: eq(PostsTable.id, postId),
  });
}

function expectSafePost(post: unknown) {
  expect(post).not.toHaveProperty("passwordHash");
  expect(post).not.toHaveProperty("passwordCipher");
  expect(post).not.toHaveProperty("publicContentJson");
  const serialized = JSON.stringify(post);
  expect(serialized).not.toContain("StoredRevisionHashMustNotLeak");
  expect(serialized).not.toContain("StoredRevisionCipherMustNotLeak");
  expect(serialized).not.toContain("PublicSnapshotMustNotLeak");
}

beforeEach(async () => {
  serial = 0;
  owner = actor("revision-owner", "revision-owner@example.com");
  otherAdmin = actor("revision-other-admin", "revision-other@example.com");
  // The configured email, rather than the ordinary admin role, grants full access.
  superAdmin = actor("revision-super", "revision-super@example.com", "user");
  for (const context of [owner, otherAdmin, superAdmin]) {
    await seedUser(db, context.session.user);
  }
});

describe("revision authorization against current D1 ownership", () => {
  it.each([
    { visibility: "private", status: "published" },
    { visibility: "password", status: "published" },
    { visibility: "public", status: "draft" },
    { visibility: "public", status: "published" },
  ] as const)("hides all revision operations for another admin's $visibility/$status post", async (options) => {
    const post = await seedPost(options);
    const revision = await createRevision(owner, post.id);
    const request = { postId: post.id, revisionId: revision.id };
    const before = await currentPost(post.id);

    expect(
      await RevisionService.listPostRevisions(otherAdmin, request),
    ).toEqual([]);
    expect(
      await RevisionService.findPostRevisionById(otherAdmin, request),
    ).toBeNull();
    expect(
      await RevisionService.createPostRevision(otherAdmin, request),
    ).toEqual({
      data: null,
      error: { reason: "POST_NOT_FOUND" },
    });
    expect(
      await RevisionService.restorePostRevision(otherAdmin, request),
    ).toEqual({
      data: null,
      error: { reason: "POST_NOT_FOUND" },
    });
    // Even a guessed, nonexistent revision must not reveal the foreign post exists.
    expect(
      await RevisionService.restorePostRevision(otherAdmin, {
        ...request,
        revisionId: revision.id + 100_000,
      }),
    ).toEqual({ data: null, error: { reason: "POST_NOT_FOUND" } });
    expect(
      unwrap(
        await RevisionService.deletePostRevisions(otherAdmin, {
          postId: post.id,
          revisionIds: [revision.id],
        }),
      ),
    ).toEqual({ deletedIds: [], deletedCount: 0 });

    expect(await currentPost(post.id)).toEqual(before);
    const stillReadable = await RevisionService.findPostRevisionById(
      owner,
      request,
    );
    expect(stillReadable?.snapshotJson.contentJson).toEqual(body(secretBody));
    expect(
      await RevisionService.listPostRevisions(owner, request),
    ).toHaveLength(1);
  });

  it.each([
    "owner",
    "superAdmin",
    "trusted",
    "trustedNull",
  ] as const)("allows %s to manage history and strips secrets from both restore response branches", async (actorName) => {
    const trusted = {
      db,
      env: owner.env,
      executionCtx: createMockExecutionCtx(),
    };
    const contexts = {
      owner,
      superAdmin,
      trusted,
      trustedNull: { ...trusted, session: null },
    };
    const context = contexts[actorName];
    const post = await seedPost();
    const revision = await createRevision(context, post.id);
    const request = { postId: post.id, revisionId: revision.id };
    expect(
      await RevisionService.listPostRevisions(context, request),
    ).toMatchObject([
      { id: revision.id, title: post.title, summary: post.summary },
    ]);
    expect(
      (await RevisionService.findPostRevisionById(context, request))
        ?.snapshotJson.contentJson,
    ).toEqual(body(secretBody));

    await db
      .update(PostsTable)
      .set({ title: "Current edit", contentJson: body("Current edit") })
      .where(eq(PostsTable.id, post.id));
    const restored = unwrap(
      await RevisionService.restorePostRevision(context, request),
    );
    expect(restored.restored).toBe(true);
    expect(restored.post.contentJson).toEqual(body(secretBody));
    expectSafePost(restored.post);
    await waitForBackgroundTasks(context.executionCtx);
    const unchanged = unwrap(
      await RevisionService.restorePostRevision(context, request),
    );
    expect(unchanged.restored).toBe(false);
    expectSafePost(unchanged.post);

    const persisted = await currentPost(post.id);
    expect(persisted?.passwordHash).toBe(post.passwordHash);
    expect(persisted?.passwordCipher).toBe(post.passwordCipher);
    expect(persisted?.publicContentJson).toEqual(post.publicContentJson);
    const revisions = await RevisionService.listPostRevisions(context, request);
    expect(revisions).toHaveLength(2);
    expect(revisions.some((item) => item.reason === "restore_backup")).toBe(
      true,
    );
    const deleted = unwrap(
      await RevisionService.deletePostRevisions(context, {
        postId: post.id,
        revisionIds: revisions.map((item) => item.id),
      }),
    );
    expect(deleted.deletedCount).toBe(2);
    expect(await RevisionService.listPostRevisions(context, request)).toEqual(
      [],
    );
  });

  it("revokes the former owner's history access immediately after ownership transfer", async () => {
    const post = await seedPost();
    const revision = await createRevision(owner, post.id);
    const request = { postId: post.id, revisionId: revision.id };
    expect(
      await RevisionService.listPostRevisions(owner, request),
    ).toHaveLength(1);
    expect(
      await RevisionService.findPostRevisionById(owner, request),
    ).not.toBeNull();
    await db
      .update(PostsTable)
      .set({ authorId: otherAdmin.session.user.id, title: "Transferred edit" })
      .where(eq(PostsTable.id, post.id));

    expect(await RevisionService.listPostRevisions(owner, request)).toEqual([]);
    expect(
      await RevisionService.findPostRevisionById(owner, request),
    ).toBeNull();
    expect(
      (await RevisionService.createPostRevision(owner, request)).error?.reason,
    ).toBe("POST_NOT_FOUND");
    expect(
      (await RevisionService.restorePostRevision(owner, request)).error?.reason,
    ).toBe("POST_NOT_FOUND");
    expect(
      unwrap(
        await RevisionService.deletePostRevisions(owner, {
          postId: post.id,
          revisionIds: [revision.id],
        }),
      ),
    ).toEqual({ deletedIds: [], deletedCount: 0 });
    expect(
      await RevisionService.findPostRevisionById(otherAdmin, request),
    ).not.toBeNull();
    const restored = unwrap(
      await RevisionService.restorePostRevision(otherAdmin, request),
    );
    expect(restored.post.contentJson).toEqual(body(secretBody));
    expect(restored.post.authorId).toBe(otherAdmin.session.user.id);
    expectSafePost(restored.post);
    await waitForBackgroundTasks(otherAdmin.executionCtx);
    expect(
      await RevisionService.findPostRevisionById(superAdmin, request),
    ).not.toBeNull();
  });

  it("keeps revision IDs bound to their post even when both posts have the same owner", async () => {
    const first = await seedPost();
    const second = await seedPost();
    const revision = await createRevision(owner, first.id);
    const request = { postId: second.id, revisionId: revision.id };
    expect(
      await RevisionService.findPostRevisionById(owner, request),
    ).toBeUndefined();
    expect(
      (await RevisionService.restorePostRevision(owner, request)).error?.reason,
    ).toBe("POST_REVISION_NOT_FOUND");
    expect(
      unwrap(
        await RevisionService.deletePostRevisions(owner, {
          postId: second.id,
          revisionIds: [revision.id],
        }),
      ),
    ).toEqual({ deletedIds: [], deletedCount: 0 });
    expect(
      await RevisionService.findPostRevisionById(owner, {
        postId: first.id,
        revisionId: revision.id,
      }),
    ).not.toBeNull();
  });
});

async function seedMediaRevision(sourceAuthorId = otherAdmin.session.user.id) {
  await db.insert(MediaTable).values({
    provider: "imgbb",
    key: "revision-private",
    url: originalUrl,
    fileName: "revision-private.webp",
    mimeType: "image/webp",
    sizeInBytes: 10,
  });
  const source = await seedPost({
    authorId: sourceAuthorId,
    status: "published",
    visibility: "public",
    contentJson: image(originalUrl),
    publicContentJson: image(originalUrl),
  });
  const target = await seedPost({ contentJson: image(originalUrl) });
  const revision = await createRevision(owner, target.id);
  await db
    .update(PostsTable)
    .set({ contentJson: body("Safe current body"), publicContentJson: null })
    .where(eq(PostsTable.id, target.id));
  return {
    source,
    target,
    revision,
    request: { postId: target.id, revisionId: revision.id },
  };
}

describe("revision restore media authorization", () => {
  it.each([
    "private",
    "password",
    "draft",
    "editable-only",
  ] as const)("rejects a historical reference when another author's media becomes %s before restore", async (restriction) => {
    const { source, target, revision, request } = await seedMediaRevision();
    await db
      .update(PostsTable)
      .set(
        restriction === "draft"
          ? { status: "draft" }
          : restriction === "editable-only"
            ? { publicContentJson: body("Published text only") }
            : { visibility: restriction },
      )
      .where(eq(PostsTable.id, source.id));
    const before = await currentPost(target.id);

    await expect(
      RevisionService.restorePostRevision(owner, request),
    ).rejects.toThrow(createPermissionError().message);
    expect(await currentPost(target.id)).toEqual(before);
    const revisions = await db
      .select()
      .from(PostRevisionsTable)
      .where(eq(PostRevisionsTable.postId, target.id));
    expect(revisions.map((item) => item.id)).toEqual([revision.id]);

    const restored = unwrap(
      await RevisionService.restorePostRevision(superAdmin, request),
    );
    expect(restored.restored).toBe(true);
    expectSafePost(restored.post);
    await waitForBackgroundTasks(superAdmin.executionCtx);
    expect((await currentPost(target.id))?.contentJson).toEqual(
      image(originalUrl),
    );
  });

  it.each([
    "public",
    "owned-private",
  ] as const)("restores readable %s media without persisting a response-only proxy URL", async (access) => {
    const { source, target, request } = await seedMediaRevision(
      access === "owned-private"
        ? owner.session.user.id
        : otherAdmin.session.user.id,
    );
    if (access === "owned-private") {
      await db
        .update(PostsTable)
        .set({ visibility: "private" })
        .where(eq(PostsTable.id, source.id));
    }
    const restored = unwrap(
      await RevisionService.restorePostRevision(owner, request),
    );
    expect(restored.restored).toBe(true);
    expectSafePost(restored.post);
    await waitForBackgroundTasks(owner.executionCtx);
    const persisted = await currentPost(target.id);
    expect(persisted?.contentJson).toEqual(image(originalUrl));
    expect(JSON.stringify(persisted?.contentJson)).not.toContain(
      "/media/file/",
    );
    expect(
      (await RevisionService.findPostRevisionById(owner, request))?.snapshotJson
        .contentJson,
    ).toEqual(image(originalUrl));
  });
});
