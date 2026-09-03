import { env } from "cloudflare:workers";
import {
  createAdminTestContext,
  createTestContext,
  testRequest,
  waitForBackgroundTasks,
} from "tests/test-utils";
import { describe, expect, it } from "vitest";
import postsUnlockRoute from "@/features/posts/api/hono/posts.unlock.route";
import { POST_RENDER_VERSION } from "@/features/posts/render-version";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as PostService from "@/features/posts/services/posts.service";
import {
  buildUnlockCookieHeader,
  hasPostUnlock,
  UNAUTHENTICATED_VIEWER,
  type ViewerAccess,
} from "@/features/posts/services/post-access.service";
import { createUnlockCookieValue } from "@/features/posts/services/post-access.service";
import { hashPassword } from "@/features/posts/utils/post-secret";
import { unwrap } from "@/lib/errors";

const SECRET_BODY = "SECRET-BODY";

/** 构造一个带门禁的文章；返回 id + slug + passwordHash */
async function seedGatedPost(
  adminContext: ReturnType<typeof createAdminTestContext>,
  options: {
    visibility: "private" | "password" | "public";
    password?: string;
    slug: string;
    title?: string;
  },
) {
  const { id } = await PostService.createEmptyPost(adminContext);
  const passwordHash = options.password
    ? await hashPassword(options.password)
    : null;
  const contentJson = {
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [{ type: "text" as const, text: SECRET_BODY }],
      },
    ],
  };
  await unwrap(
    await PostService.updatePost(adminContext, {
      id,
      data: {
        title: options.title ?? "Gated Post",
        slug: options.slug,
        status: "published",
        publishedAt: new Date(),
        visibility: options.visibility,
        passwordHash,
        passwordChannel: "post",
        contentJson,
      },
    }),
  );
  // 预烘焙公开快照，避免读取时触发懒渲染后台写库
  await PostRepo.updatePublicContentSnapshot(
    adminContext.db,
    id,
    contentJson,
    POST_RENDER_VERSION,
  );
  await waitForBackgroundTasks(adminContext.executionCtx);
  return { id, slug: options.slug, passwordHash };
}

function viewerOf(overrides: Partial<ViewerAccess> = {}): ViewerAccess {
  return { ...UNAUTHENTICATED_VIEWER, ...overrides };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
function bodyText(contentJson: any): string | undefined {
  return contentJson?.content?.[0]?.content?.[0]?.text;
}

describe("Posts Visibility Integration", () => {
  const adminContext = createAdminTestContext();
  const anonymousContext = createTestContext();

  it("anonymous viewer gets a gated shell (no content) for private posts", async () => {
    const { slug } = await seedGatedPost(adminContext, {
      visibility: "private",
      slug: "private-shell-anon",
    });

    const post = await PostService.findPostBySlug(anonymousContext, { slug });

    expect(post).not.toBeNull();
    expect(post?.gate).toBe("private");
    expect(post?.contentJson).toBeNull();
    expect(post?.toc).toBeNull();
    expect(post?.summary).toBeDefined();
  });

  it("admin viewer sees the full content of private posts", async () => {
    const { slug } = await seedGatedPost(adminContext, {
      visibility: "private",
      slug: "private-admin-content",
    });

    const post = await PostService.findPostBySlug(
      { ...adminContext, viewer: viewerOf({ isAdmin: true }) },
      { slug },
    );

    expect(post).not.toBeNull();
    expect(post?.gate).toBeNull();
    expect(bodyText(post?.contentJson)).toBe(SECRET_BODY);
  });

  it("anonymous viewer gets a password shell for password posts", async () => {
    const { slug } = await seedGatedPost(adminContext, {
      visibility: "password",
      password: "s3cret",
      slug: "password-shell-anon",
    });

    const post = await PostService.findPostBySlug(anonymousContext, { slug });

    expect(post).not.toBeNull();
    expect(post?.gate).toBe("password");
    expect(post?.contentJson).toBeNull();
  });

  it("valid unlock token grants full content for password posts", async () => {
    const { slug } = await seedGatedPost(adminContext, {
      visibility: "password",
      password: "s3cret",
      slug: "password-unlocked",
    });

    const gateMeta = await PostRepo.findPostGateBySlug(adminContext.db, slug);
    const realToken = await createUnlockCookieValue(
      anonymousContext.env,
      gateMeta?.id ?? 0,
      gateMeta?.passwordHash ?? "",
    );

    const post = await PostService.findPostBySlug(
      { ...anonymousContext, viewer: viewerOf({ unlockTokens: [realToken] }) },
      { slug },
    );

    expect(post).not.toBeNull();
    expect(post?.gate).toBeNull();
    expect(bodyText(post?.contentJson)).toBe(SECRET_BODY);
  });

  it("invalid unlock token keeps the shell", async () => {
    const { slug, passwordHash } = await seedGatedPost(adminContext, {
      visibility: "password",
      password: "s3cret",
      slug: "password-invalid-token",
    });
    const gateMeta = await PostRepo.findPostGateBySlug(adminContext.db, slug);

    // 用错误的 passwordHash 签发的令牌（等价于旧密码令牌）
    const staleToken = await createUnlockCookieValue(
      anonymousContext.env,
      gateMeta?.id ?? 0,
      `stale:${passwordHash ?? ""}`,
    );

    expect(
      await hasPostUnlock(
        anonymousContext.env,
        gateMeta?.id ?? 0,
        gateMeta?.passwordHash ?? "",
        [staleToken],
      ),
    ).toBe(false);

    const post = await PostService.findPostBySlug(
      { ...anonymousContext, viewer: viewerOf({ unlockTokens: [staleToken] }) },
      { slug },
    );
    expect(post?.gate).toBe("password");
    expect(post?.contentJson).toBeNull();
  });

  it("verify-password route sets unlock cookie on correct password", async () => {
    const { slug } = await seedGatedPost(adminContext, {
      visibility: "password",
      password: "route-pass",
      slug: "verify-route-ok",
    });

    const response = await testRequest(
      postsUnlockRoute,
      "/verify-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password: "route-pass" }),
      },
      env,
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("blog_post_unlock=");
    expect(setCookie).toContain("HttpOnly");

    // 用 Set-Cookie 里的令牌访问 → 可读正文
    const token = setCookie?.split("blog_post_unlock=")[1]?.split(";")[0] ?? "";
    const post = await PostService.findPostBySlug(
      { ...anonymousContext, viewer: viewerOf({ unlockTokens: [token] }) },
      { slug },
    );
    expect(bodyText(post?.contentJson)).toBe(SECRET_BODY);
  });

  it("verify-password route rejects wrong password and private posts", async () => {
    const wrongPass = await seedGatedPost(adminContext, {
      visibility: "password",
      password: "correct-pass",
      slug: "verify-route-wrong",
    });
    const wrongResponse = await testRequest(
      postsUnlockRoute,
      "/verify-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: wrongPass.slug, password: "nope" }),
      },
      env,
    );
    expect(wrongResponse.status).toBe(401);

    const privatePost = await seedGatedPost(adminContext, {
      visibility: "private",
      slug: "verify-route-private",
    });
    const privateResponse = await testRequest(
      postsUnlockRoute,
      "/verify-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: privatePost.slug, password: "x" }),
      },
      env,
    );
    expect(privateResponse.status).toBe(404);
  });

  it("changing the password invalidates previously issued unlock tokens", async () => {
    const { slug, passwordHash: oldHash } = await seedGatedPost(adminContext, {
      visibility: "password",
      password: "old-pass",
      slug: "token-rotation",
    });
    const gateMeta = await PostRepo.findPostGateBySlug(adminContext.db, slug);
    const oldToken = await createUnlockCookieValue(
      anonymousContext.env,
      gateMeta?.id ?? 0,
      oldHash ?? "",
    );

    // 改为新密码
    const newHash = await hashPassword("new-pass");
    await unwrap(
      await PostService.updatePost(adminContext, {
        id: gateMeta?.id ?? 0,
        data: { passwordHash: newHash },
      }),
    );
    await waitForBackgroundTasks(adminContext.executionCtx);

    const post = await PostService.findPostBySlug(
      { ...anonymousContext, viewer: viewerOf({ unlockTokens: [oldToken] }) },
      { slug },
    );
    expect(post?.gate).toBe("password");
    expect(post?.contentJson).toBeNull();

    // 新密码签发的令牌可正常解锁
    const newToken = await createUnlockCookieValue(
      anonymousContext.env,
      gateMeta?.id ?? 0,
      newHash,
    );
    const unlocked = await PostService.findPostBySlug(
      { ...anonymousContext, viewer: viewerOf({ unlockTokens: [newToken] }) },
      { slug },
    );
    expect(unlocked?.gate).toBeNull();
  });

  it("restricted posts are excluded from public lists and sitemap batches", async () => {
    await seedGatedPost(adminContext, {
      visibility: "private",
      slug: "excluded-private",
    });

    const list = await PostService.getPostsCursor(anonymousContext, {});
    expect(list.items.map((p) => p.slug)).not.toContain("excluded-private");

    const sitemapBatch = await PostRepo.getPublishedPostsForSitemapBatch(
      anonymousContext.db,
    );
    expect(sitemapBatch.map((p) => p.slug)).not.toContain("excluded-private");
  });

  it("buildUnlockCookieHeader produces a browser-usable cookie", async () => {
    const header = buildUnlockCookieHeader("abc.def");
    expect(header).toContain("blog_post_unlock=abc.def");
    expect(header).toContain("Path=/");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=2592000");
  });

  it("editor plaintext password is hashed+ciphered on save and decrypted back on read", async () => {
    const { id } = await PostService.createEmptyPost(adminContext);

    // 编辑保存：可见性=password + 明文 password → 服务端派生 hash/cipher 落库
    await unwrap(
      await PostService.updatePost(adminContext, {
        id,
        data: {
          title: "Password Post",
          slug: "password-conversion",
          status: "published",
          publishedAt: new Date(),
          visibility: "password",
          password: "correct-horse",
          passwordChannel: "post",
        },
      }),
    );
    await waitForBackgroundTasks(adminContext.executionCtx);

    const persisted = await PostRepo.findPostById(adminContext.db, id);
    expect(persisted?.passwordHash).toBeTruthy();
    expect(persisted?.passwordCipher).toBeTruthy();
    expect(persisted?.passwordCipher).not.toContain("correct-horse");

    const adminPost = await PostService.findPostById(adminContext, { id });
    expect(adminPost?.password).toBe("correct-horse");
    expect(adminPost?.visibility).toBe("password");

    // 门禁可用新密码解锁
    const gateMeta = await PostRepo.findPostGateBySlug(adminContext.db, "password-conversion");
    const token = await createUnlockCookieValue(
      adminContext.env,
      gateMeta?.id ?? 0,
      gateMeta?.passwordHash ?? "",
    );
    const unlocked = await PostService.findPostBySlug(
      { ...adminContext, viewer: viewerOf({ unlockTokens: [token] }) },
      { slug: "password-conversion" },
    );
    expect(unlocked?.gate).toBeNull();

    // 切回 public：清空密码字段
    await unwrap(
      await PostService.updatePost(adminContext, {
        id,
        data: { visibility: "public", password: "" },
      }),
    );
    await waitForBackgroundTasks(adminContext.executionCtx);
    const afterPublic = await PostRepo.findPostById(adminContext.db, id);
    expect(afterPublic?.passwordCipher).toBeNull();
    expect(afterPublic?.visibility).toBe("public");
  });
});