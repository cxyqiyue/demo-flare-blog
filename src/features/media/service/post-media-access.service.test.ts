import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/server.env", () => ({ serverEnv: (env: Env) => env }));

import {
  createUnlockCookieValue,
  createViewerAccess,
  type ViewerAccess,
} from "@/features/posts/services/post-access.service";
import { PostsTable } from "@/lib/db/schema";
import {
  applyMediaNoStoreHeaders,
  assertPostMediaReferencesReadable,
  canReadPostMedia,
  evaluatePostMediaAccess,
  filterReadableMediaItems,
  getCurrentMediaAccessPosts,
  getManagedMediaReferences,
  type MediaAccessPost,
} from "./post-media-access.service";

const env = {
  ADMIN_EMAIL: "root@example.com",
  BETTER_AUTH_SECRET: "test-media-secret-with-at-least-32-characters",
  DOMAIN: "https://blog.example.com",
} as Env;
const guest: ViewerAccess = {
  userId: null,
  isSuperAdmin: false,
  unlockTokens: [],
};
const owner: ViewerAccess = { ...guest, userId: "author" };
const admin = createViewerAccess(env, {
  id: "other-admin",
  email: "admin@example.com",
  role: "admin",
});
const superAdmin = createViewerAccess(env, {
  id: "root",
  email: "root@example.com",
  role: "user",
});
const target = { provider: "r2", key: "secret.jpg" };
const doc = (url: string) => ({
  type: "doc",
  content: [{ type: "image", attrs: { src: url } }],
});
const base: MediaAccessPost = {
  id: 1,
  authorId: "author",
  visibility: "private",
  passwordHash: null,
  status: "published",
  publishedAt: new Date("2020-01-01"),
  contentJson: doc("/images/secret.jpg"),
  publicContentJson: null,
};
function check(posts: MediaAccessPost[], viewer = guest) {
  return evaluatePostMediaAccess(env, posts, [], target, viewer, [env.DOMAIN]);
}

/** Mock only D1 pagination; the ACL and cryptographic unlock are real. */
function scanDb(posts: unknown[] = [], media: unknown[] = []): DB {
  const offsets = new Map<unknown, number>();
  return {
    select: () => {
      let table: unknown;
      const query = {
        from(value: unknown) {
          table = value;
          return query;
        },
        where() {
          return query;
        },
        orderBy() {
          return query;
        },
        async limit(size: number) {
          const source = table === PostsTable ? posts : media;
          const offset = offsets.get(table) ?? 0;
          offsets.set(table, offset + size);
          return source.slice(offset, offset + size);
        },
      };
      return query;
    },
  } as unknown as DB;
}

describe("Post-linked media current authorization", () => {
  it("permits private media only to its owner and configured super admin", async () => {
    expect(await check([base])).toEqual({ allowed: false, associated: true });
    expect(await check([base], admin)).toEqual({
      allowed: false,
      associated: true,
    });
    expect(await check([base], owner)).toEqual({
      allowed: true,
      associated: true,
    });
    expect(await check([base], superAdmin)).toEqual({
      allowed: true,
      associated: true,
    });
  });

  it("accepts a valid Post cookie, and revokes it on password/visibility changes", async () => {
    const token = await createUnlockCookieValue(env, base.id, "first-hash");
    const viewer = createViewerAccess(env, null, "blog_post_unlock=" + token);
    const post = {
      ...base,
      visibility: "password" as const,
      passwordHash: "first-hash",
    };
    expect((await check([post], viewer)).allowed).toBe(true);
    expect(
      (await check([{ ...post, passwordHash: "changed-hash" }], viewer))
        .allowed,
    ).toBe(false);
    expect(
      (await check([{ ...post, visibility: "private" }], viewer)).allowed,
    ).toBe(false);
    expect(
      (await check([post], { ...guest, unlockTokens: [token + "forged"] }))
        .allowed,
    ).toBe(false);
  });

  it("never exposes a draft Post even when visibility is public", async () => {
    const post = {
      ...base,
      visibility: "public" as const,
      status: "draft" as const,
    };
    expect((await check([post])).allowed).toBe(false);
    expect((await check([post], owner)).allowed).toBe(true);
  });

  it("protects scheduled future/null publication dates and immediately revokes withdrawn media", async () => {
    const publicPost = { ...base, visibility: "public" as const };
    expect((await check([publicPost])).allowed).toBe(true);
    expect(
      (await check([{ ...publicPost, publishedAt: new Date("2999-01-01") }]))
        .allowed,
    ).toBe(false);
    expect((await check([{ ...publicPost, publishedAt: null }])).allowed).toBe(
      false,
    );
    expect((await check([{ ...publicPost, status: "draft" }])).allowed).toBe(
      false,
    );
  });

  it("protects editable-only media while serving the existing published snapshot", async () => {
    const post = {
      ...base,
      visibility: "public" as const,
      publicContentJson: doc("/images/published.jpg"),
    };
    expect((await check([post])).allowed).toBe(false);
    expect((await check([post], owner)).allowed).toBe(true);
    expect(
      (
        await evaluatePostMediaAccess(
          env,
          [post],
          [],
          { provider: "r2", key: "published.jpg" },
          guest,
        )
      ).allowed,
    ).toBe(true);
  });

  it("applies any-readable across reused media and immediately checks each current Post", async () => {
    const publicPost = {
      ...base,
      id: 2,
      authorId: "different",
      visibility: "public" as const,
    };
    expect((await check([base, publicPost])).allowed).toBe(true);
    expect(
      (await check([base, { ...publicPost, status: "draft" }])).allowed,
    ).toBe(false);
  });

  it("retains independent site assets and unassociated media policy", async () => {
    expect(await check([])).toEqual({ allowed: true, associated: false });
    expect(
      await evaluatePostMediaAccess(
        env,
        [base],
        [],
        { provider: "r2", key: "asset/avatar.png" },
        guest,
      ),
    ).toEqual({ allowed: true, associated: false });
  });

  it("finds third-party registered URLs even with no post_media relation", async () => {
    const remote = {
      provider: "imgbb",
      key: "remote.jpg",
      url: "https://i.example.net/photo.jpg",
    };
    const post = { ...base, contentJson: doc(remote.url) };
    expect(
      await evaluatePostMediaAccess(env, [post], [remote], remote, guest),
    ).toEqual({ allowed: false, associated: true });
  });

  it("scans every page rather than leaking an association after row 100", async () => {
    const posts = Array.from({ length: 101 }, (_, index) => ({
      ...base,
      id: index + 1,
      contentJson: doc(
        index === 100 ? "/images/secret.jpg" : "/images/other.jpg",
      ),
    }));
    expect((await getCurrentMediaAccessPosts(scanDb(posts))).length).toBe(101);
    expect(
      (
        await getManagedMediaReferences(
          scanDb(
            [],
            Array.from({ length: 101 }, (_, id) => ({
              id: id + 1,
              ...target,
              url: "/images/secret.jpg",
            })),
          ),
        )
      ).length,
    ).toBe(101);
    expect(await canReadPostMedia({ env, db: scanDb(posts) }, target)).toEqual({
      allowed: false,
      associated: true,
    });
  });

  it("fails closed when the current scan fails", async () => {
    const db = {
      select: () => {
        throw new Error("D1 unavailable");
      },
    } as unknown as DB;
    await expect(canReadPostMedia({ env, db }, target)).rejects.toThrow(
      "D1 unavailable",
    );
  });

  it("blocks another admin attaching private media to a public Post", async () => {
    expect(
      await assertPostMediaReferencesReadable(
        { env, db: scanDb([base]), viewer: admin },
        null,
        base.contentJson,
      ),
    ).toBe(false);
    expect(
      await assertPostMediaReferencesReadable(
        { env, db: scanDb([base]), viewer: owner },
        null,
        base.contentJson,
      ),
    ).toBe(true);
    expect(
      await assertPostMediaReferencesReadable(
        { env, db: scanDb([base]), viewer: admin },
        base.contentJson,
        base.contentJson,
      ),
    ).toBe(true);
  });

  it("filters private associated media from an ordinary admin library", async () => {
    const items = [{ key: "secret.jpg" }, { key: "asset/avatar.png" }];
    expect(
      await filterReadableMediaItems(
        { env, db: scanDb([base]), viewer: admin },
        items,
      ),
    ).toEqual([items[1]]);
    expect(
      await filterReadableMediaItems(
        { env, db: scanDb([base]), viewer: owner },
        items,
      ),
    ).toEqual(items);
  });
});

describe("media no-store policy", () => {
  it("replaces immutable headers at every cache layer and varies by Cookie", () => {
    const headers = new Headers({
      "Cache-Control": "public, max-age=31536000",
      Vary: "Accept-Encoding",
    });
    applyMediaNoStoreHeaders(headers);
    for (const name of [
      "Cache-Control",
      "CDN-Cache-Control",
      "Cloudflare-CDN-Cache-Control",
    ])
      expect(headers.get(name)).toBe("private, no-store");
    expect(headers.get("Vary")).toBe("Accept-Encoding, Cookie, Accept");
  });
});
