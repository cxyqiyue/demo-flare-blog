import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUnlockToken,
  hashPassword,
  UNLOCK_TOKEN_TTL_SECONDS,
} from "@/features/posts/utils/post-secret";
import {
  buildUnlockCookieHeader,
  canReadPost,
  createUnlockCookieValue,
  createViewerAccess,
  extractUnlockTokens,
  hasPostUnlock,
  UNAUTHENTICATED_VIEWER,
} from "./post-access.service";

// Pure functions need only parsed configuration; no Workers bindings or database.
const env = {
  BETTER_AUTH_SECRET: "post-access-unit-secret-at-least-32-characters",
  BETTER_AUTH_URL: "https://example.com",
  ADMIN_EMAIL: "super@example.com",
  GITHUB_CLIENT_ID: "test-id",
  GITHUB_CLIENT_SECRET: "test-secret",
  DOMAIN: "example.com",
  ENVIRONMENT: "test",
} as Env;
const owner = { id: "owner", email: "owner@example.com", role: "admin" };
const otherAdmin = {
  id: "other-admin",
  email: "other@example.com",
  role: "admin",
};
const superAdmin = { id: "super", email: "SUPER@example.com", role: null };
const privatePost = {
  id: 17,
  authorId: owner.id,
  visibility: "private" as const,
  passwordHash: null,
};

afterEach(() => vi.restoreAllMocks());

describe("createViewerAccess", () => {
  it("creates an anonymous viewer for absent sessions and reads only the unlock cookie", () => {
    expect(createViewerAccess(env, null)).toEqual(UNAUTHENTICATED_VIEWER);
    expect(
      createViewerAccess(
        env,
        undefined,
        "session=ignored; blog_post_unlock=first&&second; theme=dark",
      ),
    ).toEqual({
      userId: null,
      isSuperAdmin: false,
      unlockTokens: ["first", "second"],
    });
  });

  it("derives superadmin from ADMIN_EMAIL rather than an ordinary admin role", () => {
    expect(createViewerAccess(env, owner)).toMatchObject({
      userId: owner.id,
      isSuperAdmin: false,
    });
    expect(createViewerAccess(env, otherAdmin)).toMatchObject({
      userId: otherAdmin.id,
      isSuperAdmin: false,
    });
    expect(createViewerAccess(env, superAdmin)).toMatchObject({
      userId: superAdmin.id,
      isSuperAdmin: true,
    });
    expect(
      createViewerAccess(
        { ...env, ADMIN_EMAIL: "different@example.com" },
        superAdmin,
      ).isSuperAdmin,
    ).toBe(false);
  });
});

describe("canReadPost", () => {
  it.each([
    { label: "anonymous", user: null, privateAccess: false },
    { label: "owner", user: owner, privateAccess: true },
    { label: "other ordinary admin", user: otherAdmin, privateAccess: false },
    {
      label: "superadmin without an admin role",
      user: superAdmin,
      privateAccess: true,
    },
  ])("enforces the visibility policy for $label", async ({
    user,
    privateAccess,
  }) => {
    const viewer = createViewerAccess(env, user);
    expect(
      await canReadPost(env, { ...privatePost, visibility: "public" }, viewer),
    ).toBe(true);
    expect(await canReadPost(env, privatePost, viewer)).toBe(privateAccess);
    expect(
      await canReadPost(
        env,
        { ...privatePost, visibility: "password", passwordHash: "stored-hash" },
        viewer,
      ),
    ).toBe(privateAccess);
  });

  it("does not treat a null author as anonymous ownership", async () => {
    expect(
      await canReadPost(
        env,
        { ...privatePost, authorId: null },
        createViewerAccess(env, null),
      ),
    ).toBe(false);
  });

  it("a password grant unlocks only its password post and never a private post", async () => {
    const passwordHash = await hashPassword("post-pass");
    const token = await createUnlockToken(env, privatePost.id, passwordHash);
    const viewer = createViewerAccess(
      env,
      otherAdmin,
      "blog_post_unlock=" + token,
    );
    const post = {
      ...privatePost,
      visibility: "password" as const,
      passwordHash,
    };
    expect(await canReadPost(env, post, viewer)).toBe(true);
    expect(await canReadPost(env, { ...post, id: post.id + 1 }, viewer)).toBe(
      false,
    );
    expect(
      await canReadPost(env, { ...post, visibility: "private" }, viewer),
    ).toBe(false);
    expect(
      await canReadPost(env, { ...post, passwordHash: null }, viewer),
    ).toBe(false);
    const rotatedHash = await hashPassword("new-pass");
    expect(
      await canReadPost(env, { ...post, passwordHash: rotatedHash }, viewer),
    ).toBe(false);
  });
});

describe("unlock cookies", () => {
  it.each([
    null,
    undefined,
    "",
    "other_blog_post_unlock=bad",
    "blog_post_unlock=",
  ])("ignores missing or unrelated cookie values (%s)", (header) => {
    expect(extractUnlockTokens(header)).toEqual([]);
  });

  it("builds an HTTP-only, site-wide cookie with a lifetime matching the signed grants", () => {
    const header = buildUnlockCookieHeader("grant-value");
    expect(header).toContain("blog_post_unlock=grant-value;");
    expect(header).toContain("Path=/");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=" + UNLOCK_TOKEN_TTL_SECONDS);
    expect(header).toContain("Secure");
    expect(buildUnlockCookieHeader("grant-value", false)).not.toContain(
      "Secure",
    );
  });

  it("retains another post's valid grant when issuing and renewing a grant", async () => {
    const hashA = await hashPassword("first-pass");
    const hashB = await hashPassword("second-pass");
    const first = await createUnlockCookieValue(env, 1, hashA);
    const combined = await createUnlockCookieValue(
      env,
      2,
      hashB,
      extractUnlockTokens("blog_post_unlock=" + first),
    );
    const renewed = await createUnlockCookieValue(
      env,
      1,
      hashA,
      extractUnlockTokens("blog_post_unlock=" + combined),
    );
    const tokens = extractUnlockTokens("blog_post_unlock=" + renewed);
    expect(tokens).toHaveLength(2);
    expect(await hasPostUnlock(env, 1, hashA, tokens)).toBe(true);
    expect(await hasPostUnlock(env, 2, hashB, tokens)).toBe(true);
    expect(await hasPostUnlock(env, 3, hashA, tokens)).toBe(false);
  });

  it("discards expired and malformed grants when adding a new post", async () => {
    const hash = await hashPassword("pass");
    const now = Date.now();
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(now - (UNLOCK_TOKEN_TTL_SECONDS + 1) * 1000);
    let expired: string;
    try {
      expired = await createUnlockToken(env, 1, hash);
    } finally {
      clock.mockRestore();
    }
    const cookie = await createUnlockCookieValue(env, 2, hash, [
      expired,
      "malformed",
    ]);
    const tokens = extractUnlockTokens("blog_post_unlock=" + cookie);
    expect(tokens).toHaveLength(1);
    expect(await hasPostUnlock(env, 1, hash, tokens)).toBe(false);
    expect(await hasPostUnlock(env, 2, hash, tokens)).toBe(true);
  });

  it("bounds accumulated grants while preserving the newest grant", async () => {
    const hash = await hashPassword("pass");
    const existing = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        createUnlockToken(env, index + 1, hash),
      ),
    );
    const cookie = await createUnlockCookieValue(env, 100, hash, existing);
    const tokens = extractUnlockTokens("blog_post_unlock=" + cookie);
    expect(tokens.length).toBeLessThanOrEqual(32);
    expect(await hasPostUnlock(env, 100, hash, tokens)).toBe(true);
  });

  it("checks all supplied grants without accepting a grant for another hash", async () => {
    const hash = await hashPassword("pass");
    const token = await createUnlockToken(env, 17, hash);
    expect(await hasPostUnlock(env, 17, hash, ["malformed", token])).toBe(true);
    expect(await hasPostUnlock(env, 17, "different-hash", [token])).toBe(false);
    expect(await hasPostUnlock(env, 17, null, [token])).toBe(false);
  });
});
