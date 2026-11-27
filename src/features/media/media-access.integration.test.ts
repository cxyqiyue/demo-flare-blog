import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import {
  createMockExecutionCtx,
  createMockSession,
  createTestDb,
  seedUser,
  testRequest,
} from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUnlockCookieValue } from "@/features/posts/services/post-access.service";
import { MediaTable, PostMediaTable, PostsTable } from "@/lib/db/schema";

const authState = vi.hoisted(() => ({
  session: null as AuthContext["session"] | null,
}));
vi.mock("@/lib/auth/auth.server", () => ({
  getAuth: () => ({
    api: { getSession: vi.fn(async () => authState.session) },
  }),
}));

import { app } from "@/lib/hono/routes";

const key = "media-access/secret image.webp";
const path = "/images/media-access/secret%20image.webp";
const image = (src = path) => ({
  type: "doc",
  content: [{ type: "image", attrs: { src } }],
});
const db = createTestDb();
let postId: number;
function noStore(response: Response) {
  for (const header of [
    "Cache-Control",
    "CDN-Cache-Control",
    "Cloudflare-CDN-Cache-Control",
  ]) {
    expect(response.headers.get(header)).toContain("private");
    expect(response.headers.get(header)).toContain("no-store");
  }
}

beforeEach(async () => {
  authState.session = null;
  await seedUser(db, {
    id: "media-owner",
    name: "Media Owner",
    email: "media-owner@example.com",
    role: "admin",
  });
  const [post] = await db
    .insert(PostsTable)
    .values({
      title: "Media ACL fixture",
      slug: "media-access-fixture",
      authorId: "media-owner",
      status: "published",
      visibility: "private",
      publishedAt: new Date("2020-01-01"),
      contentJson: image(),
      publicContentJson: image(),
    })
    .returning({ id: PostsTable.id });
  postId = post.id;
  // Intentionally no MediaTable/post_media rows: JSON is authoritative immediately.
  await env.R2.put(key, "secret bytes", {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
});

describe("real Hono media routes with current D1 authorization", () => {
  it.each([
    path,
    path + "?width=400",
    "/images/media-access%2Fsecret%20image.webp?original=true",
    "/media/file/r2/media-access/secret%20image.webp",
    "/media/file/r2-native/media-access%2Fsecret%20image.webp",
  ])("does not expose private bytes via aliases: %s", async (url) => {
    const response = await testRequest(app, url);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("secret bytes");
    noStore(response);
  });

  it("admits the owner and super admin but excludes an unrelated admin", async () => {
    authState.session = createMockSession({
      user: { id: "unrelated", email: "not-root@example.com", role: "admin" },
    });
    expect((await testRequest(app, path)).status).toBe(404);
    for (const user of [
      { id: "media-owner", email: "media-owner@example.com", role: "admin" },
      { id: "super", email: env.ADMIN_EMAIL, role: "user" },
    ]) {
      authState.session = createMockSession({ user });
      const response = await testRequest(app, path + "?width=400");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("secret bytes");
      noStore(response);
    }
  });

  it("gates HEAD and returns no bytes with private headers for an authorized HEAD", async () => {
    const denied = await testRequest(app, path, { method: "HEAD" });
    expect(denied.status).toBe(404);
    noStore(denied);
    authState.session = createMockSession({
      user: { id: "media-owner", email: "media-owner@example.com" },
    });
    const allowed = await testRequest(app, path, { method: "HEAD" });
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toBe("");
    noStore(allowed);
  });

  it("accepts only a valid password grant and immediately revokes it after password changes", async () => {
    await db
      .update(PostsTable)
      .set({ visibility: "password", passwordHash: "first-hash" })
      .where(eq(PostsTable.id, postId));
    const token = await createUnlockCookieValue(env, postId, "first-hash");
    const options = { headers: { Cookie: "blog_post_unlock=" + token } };
    expect((await testRequest(app, path)).status).toBe(404);
    const allowed = await testRequest(app, path, options);
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toBe("secret bytes");
    noStore(allowed);
    await db
      .update(PostsTable)
      .set({ passwordHash: "second-hash" })
      .where(eq(PostsTable.id, postId));
    const revoked = await testRequest(app, path, options);
    expect(revoked.status).toBe(404);
    noStore(revoked);
  });

  it("uses any-readable current Post and revokes public access on withdrawal", async () => {
    await db.insert(PostsTable).values({
      title: "Shared public image",
      slug: "shared-public-media",
      authorId: "media-owner",
      status: "published",
      visibility: "public",
      publishedAt: new Date("2020-01-01"),
      contentJson: image(),
      publicContentJson: image(),
    });
    const publicResponse = await testRequest(app, path);
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.text()).toBe("secret bytes");
    noStore(publicResponse);
    await db
      .update(PostsTable)
      .set({ status: "draft" })
      .where(eq(PostsTable.slug, "shared-public-media"));
    expect((await testRequest(app, path)).status).toBe(404);
  });

  it("does not treat public-but-future or unpublished editable-only images as public", async () => {
    await db
      .update(PostsTable)
      .set({ visibility: "public", publishedAt: new Date("2999-01-01") })
      .where(eq(PostsTable.id, postId));
    expect((await testRequest(app, path)).status).toBe(404);
    await db
      .update(PostsTable)
      .set({
        publishedAt: new Date("2020-01-01"),
        publicContentJson: image("/images/already-published.webp"),
      })
      .where(eq(PostsTable.id, postId));
    expect((await testRequest(app, path)).status).toBe(404);
  });

  it("finds a registered third-party direct URL without touching its upstream", async () => {
    const url = "https://public.example.net/remote-photo.jpg?key=123";
    await db.insert(MediaTable).values({
      provider: "imgbb",
      key: "remote-secret",
      url,
      fileName: "remote.jpg",
      mimeType: "image/jpeg",
      sizeInBytes: 10,
    });
    await db
      .update(PostsTable)
      .set({ contentJson: image(url), publicContentJson: image(url) })
      .where(eq(PostsTable.id, postId));
    const response = await testRequest(app, "/media/file/imgbb/remote-secret");
    expect(response.status).toBe(404);
    noStore(response);
    expect(await db.select().from(PostMediaTable)).toHaveLength(0);
  });

  it("ignores a poisoned application cache before authenticating", async () => {
    const request = new Request("http://localhost" + path);
    await (caches as unknown as { default: Cache }).default.put(
      request,
      new Response("old secret bytes", {
        headers: { "Cache-Control": "public, max-age=3600" },
      }),
    );
    const response = await app.request(path, {}, env, createMockExecutionCtx());
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("old secret bytes");
    noStore(response);
  });

  it("preserves independent site assets and marks missing-object errors private", async () => {
    await env.R2.put("asset/media-site-avatar.png", "site avatar");
    const independent = await testRequest(
      app,
      "/images/asset/media-site-avatar.png?original=true",
    );
    expect(independent.status).toBe(200);
    expect(await independent.text()).toBe("site avatar");
    noStore(independent);
    const missing = await testRequest(
      app,
      "/images/missing-unrelated.jpg?original=true",
    );
    expect(missing.status).toBe(404);
    noStore(missing);
  });
});
