import { env } from "cloudflare:workers";
import {
  createAdminTestContext,
  createMockSession,
  createTestContext,
  seedUser,
  testRequest,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import postsDetailRoute from "@/features/posts/api/hono/posts.detail.route";
import postsUnlockRoute from "@/features/posts/api/hono/posts.unlock.route";
import * as PostRepo from "@/features/posts/data/posts.data";
import { POST_RENDER_VERSION } from "@/features/posts/render-version";
import {
  PostUpdateSchema,
  type UpdatePostInput,
} from "@/features/posts/schema/posts.schema";
import {
  createUnlockCookieValue,
  createViewerAccess,
  extractUnlockTokens,
} from "@/features/posts/services/post-access.service";
import * as PostService from "@/features/posts/services/posts.service";
import {
  UNLOCK_TOKEN_TTL_SECONDS,
  verifyPassword,
} from "@/features/posts/utils/post-secret";
import { createMyDb } from "@/features/search/model/schema";
import { persistOramaDb } from "@/features/search/model/store";
import * as SearchService from "@/features/search/service/search.service";
import * as TagService from "@/features/tags/tags.service";
import { unwrap } from "@/lib/errors";

const SECRET_BODY = "VisibilitySecretBody";
const SECRET_SUMMARY = "VisibilitySecretSummary";
const SECRET_HINT = "Contact the owner for the private phrase";
const OWNER_NAME = "Visibility Owner";
const OWNER_ID = "visibility-owner";

type ActorContext = ReturnType<typeof createActorContext>;
type PostResponse = Awaited<ReturnType<typeof PostService.findPostBySlug>>;

function createActorContext(
  id: string,
  email: string,
  name: string,
  role: string | null = "admin",
) {
  const session = createMockSession({
    user: { id, email, name, role },
    session: { userId: id },
  });
  const context = createAdminTestContext({ session });
  return { ...context, viewer: createViewerAccess(context.env, session.user) };
}

async function seedPost(
  context: ActorContext,
  options: {
    slug: string;
    visibility: "public" | "private" | "password";
    password?: string;
    title?: string;
    status?: "published" | "draft";
    publishedAt?: Date;
  },
) {
  const { id } = await PostService.createEmptyPost(context);
  const contentJson = {
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [{ type: "text" as const, text: SECRET_BODY }],
      },
    ],
  };
  unwrap(
    await PostService.updatePost(context, {
      id,
      data: {
        title: options.title ?? "VisibilitySecretTitle",
        summary: SECRET_SUMMARY,
        slug: options.slug,
        status: options.status ?? "published",
        publishedAt: options.publishedAt ?? new Date(Date.now() - 10_000),
        visibility: options.visibility,
        password: options.password,
        passwordChannel: "post",
        passwordHint: SECRET_HINT,
        contentJson,
      },
    }),
  );
  await PostRepo.updatePublicContentSnapshot(
    context.db,
    id,
    contentJson,
    POST_RENDER_VERSION,
  );
  await waitForBackgroundTasks(context.executionCtx);
  const persisted = await PostRepo.findPostById(context.db, id);
  if (!persisted) throw new Error("seedPost did not persist a post");
  return persisted;
}

function expectNoStoredCredentials(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(
    /"(?:passwordHash|passwordCipher)"\s*:/,
  );
}

function expectFullPost(post: PostResponse) {
  expect(post).not.toBeNull();
  expect(post?.gate).toBeNull();
  expect(JSON.stringify(post?.contentJson)).toContain(SECRET_BODY);
  expectNoStoredCredentials(post);
  expect(post).not.toHaveProperty("password");
}

function expectPrivateShell(post: unknown) {
  expect(post).toMatchObject({
    gate: "private",
    title: "",
    summary: "",
    authorId: null,
    author: null,
    passwordChannel: null,
    passwordHint: null,
    contentJson: null,
    toc: null,
  });
  expectNoStoredCredentials(post);
  const serialized = JSON.stringify(post);
  for (const secret of [
    SECRET_BODY,
    SECRET_SUMMARY,
    "VisibilitySecretTitle",
    OWNER_NAME,
    OWNER_ID,
    SECRET_HINT,
  ]) {
    expect(serialized).not.toContain(secret);
  }
}

async function requestDetail(slug: string, cookie?: string) {
  const response = await testRequest(
    postsDetailRoute,
    "/" + slug,
    {
      method: "GET",
      headers: cookie ? { Cookie: cookie } : {},
    },
    env,
  );
  return { response, body: (await response.json()) as Record<string, unknown> };
}

function requestUnlock(slug: string, password: string, cookie?: string) {
  return testRequest(
    postsUnlockRoute,
    "/verify-password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ slug, password }),
    },
    env,
  );
}

function cookieFromResponse(response: Response) {
  const header = response.headers.get("set-cookie");
  expect(header).toContain("blog_post_unlock=");
  expect(header).toContain("HttpOnly");
  expect(header).toContain("Path=/");
  expect(header).toContain("SameSite=Lax");
  if (!header) throw new Error("Expected an unlock cookie");
  return header.split(";")[0];
}

describe("Posts visibility integration", () => {
  let owner: ActorContext;
  let otherAdmin: ActorContext;
  let superAdmin: ActorContext;
  let anonymous: ReturnType<typeof createTestContext>;

  beforeEach(async () => {
    owner = createActorContext(
      OWNER_ID,
      "visibility-owner@example.com",
      OWNER_NAME,
    );
    otherAdmin = createActorContext(
      "visibility-other-admin",
      "visibility-other@example.com",
      "Other Admin",
    );
    // ADMIN_EMAIL grants access even when the database role is not admin.
    superAdmin = createActorContext(
      "visibility-super",
      env.ADMIN_EMAIL,
      "Super Admin",
      null,
    );
    anonymous = createTestContext();
    for (const context of [owner, otherAdmin, superAdmin]) {
      await seedUser(context.db, context.session.user);
    }
    await persistOramaDb(owner.env, await createMyDb());
  });

  it.each([
    "anonymous",
    "owner",
    "otherAdmin",
    "superAdmin",
  ] as const)("%s reads public content without exposing stored credentials", async (actor) => {
    const post = await seedPost(owner, {
      slug: "public-matrix",
      visibility: "public",
    });
    const context = { anonymous, owner, otherAdmin, superAdmin }[actor];
    expectFullPost(
      await PostService.findPostBySlug(context, { slug: post.slug }),
    );
  });

  it.each([
    "anonymous",
    "owner",
    "otherAdmin",
    "superAdmin",
  ] as const)("%s receives only the private content allowed by ownership", async (actor) => {
    const post = await seedPost(owner, {
      slug: "private-matrix",
      visibility: "private",
    });
    const context = { anonymous, owner, otherAdmin, superAdmin }[actor];
    const result = await PostService.findPostBySlug(context, {
      slug: post.slug,
    });
    if (actor === "owner" || actor === "superAdmin") expectFullPost(result);
    else expectPrivateShell(result);
  });

  it.each([
    "anonymous",
    "owner",
    "otherAdmin",
    "superAdmin",
  ] as const)("%s cannot bypass a password gate using the ordinary admin role", async (actor) => {
    const post = await seedPost(owner, {
      slug: "password-matrix",
      visibility: "password",
      password: "matrix-pass",
    });
    const context = { anonymous, owner, otherAdmin, superAdmin }[actor];
    const result = await PostService.findPostBySlug(context, {
      slug: post.slug,
    });
    if (actor === "owner" || actor === "superAdmin") expectFullPost(result);
    else {
      expect(result).toMatchObject({
        gate: "password",
        contentJson: null,
        toc: null,
        summary: "",
      });
      expect(JSON.stringify(result)).not.toContain(SECRET_BODY);
      expect(JSON.stringify(result)).not.toContain(SECRET_SUMMARY);
      expect(JSON.stringify(result)).not.toContain("matrix-pass");
      expectNoStoredCredentials(result);
    }
  });

  it("the anonymous detail API hides private metadata and stored secrets", async () => {
    const post = await seedPost(owner, {
      slug: "private-api",
      visibility: "private",
    });
    const { response, body } = await requestDetail(post.slug);
    expect(response.status).toBe(200);
    expectPrivateShell(body);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it.each([
    ["private", { visibility: "private" as const }],
    ["password", { visibility: "password" as const, password: "admin-pass" }],
    ["draft", { visibility: "public" as const, status: "draft" as const }],
  ] as const)("%s admin slug reads enforce ownership and redact stored credentials", async (label, fixture) => {
    const post = await seedPost(owner, {
      slug: "admin-" + label,
      ...fixture,
    });

    expect(
      await PostService.findPostBySlugAdmin(otherAdmin, { slug: post.slug }),
    ).toBeNull();

    for (const context of [owner, superAdmin]) {
      const result = await PostService.findPostBySlugAdmin(context, {
        slug: post.slug,
      });
      expect(result).not.toBeNull();
      expect(result?.title).toBe("VisibilitySecretTitle");
      expect(result?.summary).toBe(SECRET_SUMMARY);
      expect(JSON.stringify(result?.contentJson)).toContain(SECRET_BODY);
      expect(result?.toc).toEqual([]);
      expectNoStoredCredentials(result);
      expect(result).not.toHaveProperty("publicContentJson");
      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("passwordCipher");
    }
  });

  it("lists include only public/password posts, an owner's own private posts, or all posts for the superadmin", async () => {
    const publicPost = await seedPost(owner, {
      slug: "list-public",
      visibility: "public",
    });
    const passwordPost = await seedPost(owner, {
      slug: "list-password",
      visibility: "password",
      password: "list-pass",
    });
    const privatePost = await seedPost(owner, {
      slug: "list-private",
      visibility: "private",
    });
    const otherPrivate = await seedPost(otherAdmin, {
      slug: "list-other-private",
      visibility: "private",
    });
    for (const [context, expectedIds] of [
      [anonymous, [publicPost.id, passwordPost.id]],
      [owner, [publicPost.id, passwordPost.id, privatePost.id]],
      [otherAdmin, [publicPost.id, passwordPost.id, otherPrivate.id]],
      [
        superAdmin,
        [publicPost.id, passwordPost.id, privatePost.id, otherPrivate.id],
      ],
    ] as const) {
      const cursor = await PostService.getPostsCursor(context, { limit: 50 });
      const page = await PostService.getPublicPostsPage(context, { limit: 50 });
      for (const result of [cursor, page]) {
        expect(
          result.items.map((post) => post.id).sort((a, b) => a - b),
        ).toEqual([...expectedIds].sort((a, b) => a - b));
        expectNoStoredCredentials(result);
      }
      expect(page.total).toBe(expectedIds.length);
      const lockedSummary = cursor.items.find(
        (post) => post.id === passwordPost.id,
      )?.summary;
      expect(lockedSummary).toBe(
        context === owner || context === superAdmin ? SECRET_SUMMARY : "",
      );
      expect(
        page.items.find((post) => post.id === passwordPost.id)?.summary,
      ).toBe(lockedSummary);
    }
    const sitemap = await PostRepo.getPublishedPostsForSitemapBatch(owner.db);
    expect(sitemap.map((post) => post.id)).toEqual([publicPost.id]);
  });

  it("public → private → public → password transitions immediately update warmed lists, details, and search", async () => {
    const post = await seedPost(owner, {
      slug: "immediate-transition",
      title: "VisibilityTransitionMarker",
      visibility: "public",
    });
    const query = {
      q: "VisibilityTransitionMarker",
      v: "same-client-version",
      limit: 10,
    };
    expect(
      (await SearchService.search(anonymous, query)).map((hit) => hit.post.id),
    ).toContain(String(post.id));
    expectFullPost(
      await PostService.findPostBySlug(anonymous, { slug: post.slug }),
    );
    await PostService.getPostsCursor(anonymous, {});
    await PostService.getPublicPostsPage(anonymous, {});

    for (const visibility of [
      "private",
      "public",
      "password",
      "public",
    ] as const) {
      unwrap(
        await PostService.updatePost(owner, {
          id: post.id,
          data: {
            visibility,
            ...(visibility === "password"
              ? { password: "transition-pass" }
              : {}),
          },
        }),
      );
      // Deliberately do not drain background work between save and these reads.
      const cursor = await PostService.getPostsCursor(anonymous, {});
      const page = await PostService.getPublicPostsPage(anonymous, {});
      const detail = await PostService.findPostBySlug(anonymous, {
        slug: post.slug,
      });
      const search = await SearchService.search(anonymous, query);
      expect(cursor.items.some((item) => item.id === post.id)).toBe(
        visibility !== "private",
      );
      expect(page.items.some((item) => item.id === post.id)).toBe(
        visibility !== "private",
      );
      expect(page.total).toBe(visibility === "private" ? 0 : 1);
      expect(search.some((hit) => hit.post.id === String(post.id))).toBe(
        visibility === "public",
      );
      if (visibility === "public") expectFullPost(detail);
      else {
        expect(detail?.gate).toBe(visibility);
        expect(detail?.contentJson).toBeNull();
        expect(detail?.summary).toBe("");
      }
      expectNoStoredCredentials({ cursor, page, detail, search });
    }
  });

  it.each([
    "private",
    "password",
  ] as const)("%s source posts gate related and adjacent results even after public navigation is warmed", async (visibility) => {
    const now = Date.now();
    const previous = await seedPost(owner, {
      slug: "navigation-before",
      visibility: "public",
      publishedAt: new Date(now - 180_000),
    });
    const source = await seedPost(owner, {
      slug: "navigation-source",
      visibility: "public",
      publishedAt: new Date(now - 120_000),
    });
    const next = await seedPost(owner, {
      slug: "navigation-after",
      visibility: "public",
      publishedAt: new Date(now - 60_000),
    });
    const tag = unwrap(
      await TagService.createTag(owner, { name: "NavigationAccess" }),
    );
    for (const post of [previous, source, next]) {
      await TagService.setPostTags(owner, {
        postId: post.id,
        tagIds: [tag.id],
      });
    }
    const assertNavigationAllowed = async (
      context: Parameters<typeof PostService.getRelatedPosts>[0],
    ) => {
      const related = await PostService.getRelatedPosts(context, {
        slug: source.slug,
        limit: 10,
      });
      expect(related.map((post) => post.id).sort((a, b) => a - b)).toEqual(
        [previous.id, next.id].sort((a, b) => a - b),
      );
      const adjacent = await PostService.findAdjacentPosts(context, {
        slug: source.slug,
      });
      expect(adjacent).toMatchObject({
        previous: { id: previous.id, slug: previous.slug },
        next: { id: next.id, slug: next.slug },
      });
      expectNoStoredCredentials({ related, adjacent });
    };
    await assertNavigationAllowed(anonymous);
    unwrap(
      await PostService.updatePost(owner, {
        id: source.id,
        data: {
          visibility,
          ...(visibility === "password" ? { password: "navigation-pass" } : {}),
        },
      }),
    );
    // The warmed source's related IDs must not bypass its current gate.
    for (const context of [anonymous, otherAdmin]) {
      expect(
        await PostService.getRelatedPosts(context, {
          slug: source.slug,
          limit: 10,
        }),
      ).toEqual([]);
      expect(
        await PostService.findAdjacentPosts(context, { slug: source.slug }),
      ).toEqual({ previous: null, next: null });
    }
    await assertNavigationAllowed(owner);
    await assertNavigationAllowed(superAdmin);
    if (visibility === "password") {
      const unlocked = await requestUnlock(source.slug, "navigation-pass");
      expect(unlocked.status).toBe(200);
      await assertNavigationAllowed({
        ...anonymous,
        viewer: createViewerAccess(
          anonymous.env,
          null,
          cookieFromResponse(unlocked),
        ),
      });
    }
  });

  it("restricted metadata is read fresh after an editor saves a new title and hint", async () => {
    const post = await seedPost(owner, {
      slug: "fresh-password-shell",
      visibility: "password",
      password: "shell-pass",
    });
    const before = await PostService.findPostBySlug(anonymous, {
      slug: post.slug,
    });
    expect(before?.passwordHint).toBe(SECRET_HINT);
    unwrap(
      await PostService.updatePost(owner, {
        id: post.id,
        data: { title: "Updated gated title", passwordHint: "Updated hint" },
      }),
    );
    const { body } = await requestDetail(post.slug);
    expect(body).toMatchObject({
      title: "Updated gated title",
      passwordHint: "Updated hint",
      summary: "",
      gate: "password",
      contentJson: null,
    });
    expectNoStoredCredentials(body);
  });

  it("correct password unlocks the real detail API and wrong password grants no cookie", async () => {
    const post = await seedPost(owner, {
      slug: "unlock-api",
      visibility: "password",
      password: "route-pass",
    });
    const wrong = await requestUnlock(post.slug, "wrong-pass");
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ ok: false, code: "WRONG_PASSWORD" });
    expect(wrong.headers.get("set-cookie")).toBeNull();
    const locked = await requestDetail(post.slug);
    expect(locked.body).toMatchObject({
      gate: "password",
      contentJson: null,
      summary: "",
    });
    const unlocked = await requestUnlock(post.slug, "route-pass");
    expect(unlocked.status).toBe(200);
    expect(await unlocked.json()).toEqual({ ok: true });
    expect(unlocked.headers.get("Cache-Control")).toContain("no-store");
    const { response, body } = await requestDetail(
      post.slug,
      cookieFromResponse(unlocked),
    );
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ gate: null });
    expect(JSON.stringify(body.contentJson)).toContain(SECRET_BODY);
    expectNoStoredCredentials(body);
    expect(body).not.toHaveProperty("password");
    expect(JSON.stringify(body)).not.toContain("route-pass");
  });

  it("unlock API returns the same not-found response for private and unknown posts", async () => {
    const post = await seedPost(owner, {
      slug: "private-unlock",
      visibility: "private",
    });
    for (const slug of [post.slug, "unknown-visibility-post"]) {
      const response = await requestUnlock(slug, "any-pass");
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        ok: false,
        code: "POST_NOT_FOUND",
      });
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("unlocking a second post and renewing the first preserves both browser grants", async () => {
    const first = await seedPost(owner, {
      slug: "multi-first",
      visibility: "password",
      password: "first-pass",
    });
    const second = await seedPost(owner, {
      slug: "multi-second",
      visibility: "password",
      password: "second-pass",
    });
    const firstResponse = await requestUnlock(first.slug, "first-pass");
    expect(firstResponse.status).toBe(200);
    const firstCookie = cookieFromResponse(firstResponse);
    expect((await requestDetail(second.slug, firstCookie)).body.gate).toBe(
      "password",
    );
    const secondResponse = await requestUnlock(
      second.slug,
      "second-pass",
      firstCookie,
    );
    expect(secondResponse.status).toBe(200);
    const bothCookie = cookieFromResponse(secondResponse);
    const renewed = await requestUnlock(first.slug, "first-pass", bothCookie);
    expect(renewed.status).toBe(200);
    const renewedCookie = cookieFromResponse(renewed);
    expect(extractUnlockTokens(renewedCookie)).toHaveLength(2);
    for (const slug of [first.slug, second.slug]) {
      const { body } = await requestDetail(slug, renewedCookie);
      expect(body.gate).toBeNull();
      expect(JSON.stringify(body.contentJson)).toContain(SECRET_BODY);
      expectNoStoredCredentials(body);
    }
    const failed = await requestUnlock(second.slug, "incorrect", renewedCookie);
    expect(failed.status).toBe(401);
    expect(failed.headers.get("set-cookie")).toBeNull();
    expect(
      (await requestDetail(first.slug, renewedCookie)).body.gate,
    ).toBeNull();
  });

  it("an expired signed grant and a malformed grant leave the API locked", async () => {
    const post = await seedPost(owner, {
      slug: "expired-api-token",
      visibility: "password",
      password: "expiry-pass",
    });
    const now = Date.now();
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(now - (UNLOCK_TOKEN_TTL_SECONDS + 1) * 1000);
    let expired: string;
    try {
      expired = await createUnlockCookieValue(
        owner.env,
        post.id,
        post.passwordHash ?? "",
      );
    } finally {
      clock.mockRestore();
    }
    for (const token of [expired, "malformed-token"]) {
      const { body } = await requestDetail(
        post.slug,
        "blog_post_unlock=" + token,
      );
      expect(body).toMatchObject({
        gate: "password",
        contentJson: null,
        summary: "",
      });
      expectNoStoredCredentials(body);
    }
  });

  it("plaintext save derives secrets only on the server and editor reads never expose hash or cipher", async () => {
    const post = await seedPost(owner, {
      slug: "plaintext-persistence",
      visibility: "password",
      password: "correct-horse",
    });
    expect(post.passwordHash).toBeTruthy();
    expect(post.passwordCipher).toBeTruthy();
    expect(post.passwordHash).not.toContain("correct-horse");
    expect(post.passwordCipher).not.toContain("correct-horse");
    expect(await verifyPassword("correct-horse", post.passwordHash)).toBe(true);
    const saved = unwrap(
      await PostService.updatePost(owner, {
        id: post.id,
        data: { visibility: "password", password: "correct-horse" },
      }),
    );
    expectNoStoredCredentials(saved);
    expect(saved).not.toHaveProperty("publicContentJson");
    expect(saved).not.toHaveProperty("password");
    const editor = await PostService.findPostById(owner, { id: post.id });
    expect(editor?.password).toBe("correct-horse");
    expectNoStoredCredentials(editor);
    unwrap(
      await PostService.updatePost(owner, {
        id: post.id,
        data: { visibility: "public", password: "" },
      }),
    );
    const publicRow = await PostRepo.findPostById(owner.db, post.id);
    expect(publicRow?.passwordHash).toBeNull();
    expect(publicRow?.passwordCipher).toBeNull();
  });

  it.each([
    undefined,
    "",
    "   ",
  ])("entering password mode without a usable password (%s) fails atomically", async (password) => {
    const post = await seedPost(owner, {
      slug: "missing-password",
      visibility: "public",
    });
    const result = await PostService.updatePost(owner, {
      id: post.id,
      data: { visibility: "password", password },
    });
    expect(result.error?.reason).toBe("PASSWORD_REQUIRED");
    const row = await PostRepo.findPostById(owner.db, post.id);
    expect(row?.visibility).toBe("public");
    expect(row?.passwordHash).toBeNull();
    expectFullPost(
      await PostService.findPostBySlug(anonymous, { slug: post.slug }),
    );
  });

  it("unrelated edits, empty password, and the same plaintext password preserve existing grants", async () => {
    const post = await seedPost(owner, {
      slug: "stable-password",
      visibility: "password",
      password: "stable-pass",
    });
    const response = await requestUnlock(post.slug, "stable-pass");
    expect(response.status).toBe(200);
    const cookie = cookieFromResponse(response);
    for (const data of [
      { title: "Unrelated title edit" },
      { password: "" },
      { password: "stable-pass" },
    ]) {
      unwrap(await PostService.updatePost(owner, { id: post.id, data }));
      const current = await PostRepo.findPostById(owner.db, post.id);
      expect(current?.passwordHash).toBe(post.passwordHash);
      expect(current?.passwordCipher).toBe(post.passwordCipher);
      expect((await requestDetail(post.slug, cookie)).body.gate).toBeNull();
    }
  });

  it("password-only updates use the stored visibility, revoke old grants, and accept only the new password", async () => {
    const post = await seedPost(owner, {
      slug: "password-rotation",
      visibility: "password",
      password: "old-pass",
    });
    const oldResponse = await requestUnlock(post.slug, "old-pass");
    expect(oldResponse.status).toBe(200);
    const oldCookie = cookieFromResponse(oldResponse);
    expect((await requestDetail(post.slug, oldCookie)).body.gate).toBeNull();
    unwrap(
      await PostService.updatePost(owner, {
        id: post.id,
        data: { password: "new-pass" },
      }),
    );
    const changed = await PostRepo.findPostById(owner.db, post.id);
    expect(changed?.passwordHash).not.toBe(post.passwordHash);
    expect(changed?.visibility).toBe("password");
    expect((await requestDetail(post.slug, oldCookie)).body).toMatchObject({
      gate: "password",
      contentJson: null,
    });
    expect((await requestUnlock(post.slug, "old-pass", oldCookie)).status).toBe(
      401,
    );
    const newResponse = await requestUnlock(post.slug, "new-pass", oldCookie);
    expect(newResponse.status).toBe(200);
    const newCookie = cookieFromResponse(newResponse);
    expect(extractUnlockTokens(newCookie)).toHaveLength(1);
    expect((await requestDetail(post.slug, newCookie)).body.gate).toBeNull();
  });

  it("changing access modes revokes old grants even when password mode later reuses the same plaintext", async () => {
    const post = await seedPost(owner, {
      slug: "mode-rotation",
      visibility: "password",
      password: "same-phrase",
    });
    const response = await requestUnlock(post.slug, "same-phrase");
    expect(response.status).toBe(200);
    const cookie = cookieFromResponse(response);
    unwrap(
      await PostService.updatePost(owner, {
        id: post.id,
        data: { visibility: "private" },
      }),
    );
    expect((await requestDetail(post.slug, cookie)).body).toMatchObject({
      gate: "private",
      title: "",
      summary: "",
      author: null,
      authorId: null,
      contentJson: null,
    });
    unwrap(
      await PostService.updatePost(owner, {
        id: post.id,
        data: { visibility: "password", password: "same-phrase" },
      }),
    );
    expect((await requestDetail(post.slug, cookie)).body).toMatchObject({
      gate: "password",
      contentJson: null,
    });
    const fresh = await requestUnlock(post.slug, "same-phrase", cookie);
    expect(fresh.status).toBe(200);
    expect(
      (await requestDetail(post.slug, cookieFromResponse(fresh))).body.gate,
    ).toBeNull();
  });

  it("caller-supplied hash/cipher fields are omitted by validation and cannot replace stored secrets", async () => {
    const post = await seedPost(owner, {
      slug: "forged-fields",
      visibility: "password",
      password: "real-pass",
    });
    const forged = {
      title: "Legitimate title",
      passwordHash: "caller-hash",
      passwordCipher: "caller-cipher",
    };
    expect(PostUpdateSchema.parse(forged)).toEqual({
      title: "Legitimate title",
    });
    // Deliberately exercise an untyped internal caller, rather than using forged fields to seed a post.
    unwrap(
      await PostService.updatePost(owner, {
        id: post.id,
        data: forged as UpdatePostInput["data"],
      }),
    );
    const row = await PostRepo.findPostById(owner.db, post.id);
    expect(row?.passwordHash).toBe(post.passwordHash);
    expect(row?.passwordCipher).toBe(post.passwordCipher);
    expect(row?.title).toBe("Legitimate title");
    expect((await requestUnlock(post.slug, "real-pass")).status).toBe(200);
  });
});
