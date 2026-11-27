import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/challenge/service/challenge.service", () => ({
  getChallengeServerConfig: vi.fn(),
  isChallengeReady: vi.fn(() => false),
  isFullSiteChallengeEnabled: vi.fn(() => false),
  verifyAltchaSolutionPayload: vi.fn(),
}));
vi.mock("@/features/config/service/config.service", () => ({
  getSystemConfig: vi.fn(async () => ({})),
}));
vi.mock("@/features/media/service/link-access.service", () => ({
  getLinkAccessSettings: vi.fn(() => ({ mode: "public" })),
}));
vi.mock("@/lib/auth/auth.server", () => ({ getAuth: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/env/server.env", () => ({ serverEnv: vi.fn() }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: vi.fn() }));

import { cacheMiddleware, privateNoStoreMiddleware } from "./middlewares";

function expectPrivate(response: Response) {
  for (const header of [
    "Cache-Control",
    "CDN-Cache-Control",
    "Cloudflare-CDN-Cache-Control",
  ]) {
    expect(response.headers.get(header)).toContain("private");
    expect(response.headers.get(header)).toContain("no-store");
  }
}

describe("cacheMiddleware access isolation", () => {
  const match = vi.fn();
  const put = vi.fn(async () => {});

  beforeEach(() => {
    match.mockReset();
    put.mockClear();
    match.mockImplementation(async () => new Response("old private body"));
    vi.stubGlobal("caches", { default: { match, put } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "/api/posts",
    "/api/posts/page?offset=10",
    "/api/post/secret",
    "/api/post/secret/adjacent",
    "/api/post/secret/related",
    "/api/search?q=secret",
    "/api/search/meta",
    "/",
    "/posts?categoryName=secret",
    "/post/secret",
    "/search?q=secret",
    "/about",
    "/moments",
    "/friend-links",
    "/navigation",
    "/unsubscribe",
    "/atom.xml",
    "/rss.xml",
    "/feed.json",
    "/sitemap.xml",
  ])("does not read a poisoned URL cache for %s", async (path) => {
    const app = new Hono();
    app.use("*", cacheMiddleware);
    app.get("*", (c) => c.text("current gated response", 200, {
      "Cache-Control": "public, max-age=600",
      "CDN-Cache-Control": "public, max-age=600",
      "Cloudflare-CDN-Cache-Control": "public, max-age=600",
    }));
    const response = await app.request(path);
    expect(await response.text()).toBe("current gated response");
    expectPrivate(response);
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    ["cookie", "session=author"],
    ["authorization", "Bearer author"],
    ["cookie", ""],
  ])("isolates any personalized request: %j", async (name, value) => {
    const app = new Hono();
    app.use("*", cacheMiddleware);
    app.get("*", (c) => c.text("viewer response"));
    const response = await app.request("/api/tags", {
      headers: { [name]: value },
    });
    expect(await response.text()).toBe("viewer response");
    expectPrivate(response);
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("never reuses an author response for the following anonymous reader", async () => {
    const app = new Hono();
    app.use("*", cacheMiddleware);
    app.get("/api/post/secret", (c) => c.json(
      c.req.header("Cookie") ? { body: "author content" } : { gate: "private" },
    ));
    const author = await app.request("/api/post/secret", {
      headers: { Cookie: "session=author" },
    });
    expect(await author.json()).toEqual({ body: "author content" });
    const guest = await app.request("/api/post/secret");
    expect(await guest.json()).toEqual({ gate: "private" });
    expectPrivate(author);
    expectPrivate(guest);
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it.each([404, 500] as const)("does not replace private headers with a %s cache strategy", async (status) => {
    const app = new Hono();
    app.use("*", cacheMiddleware);
    app.get("*", (c) => c.text("unavailable", status));
    const response = await app.request("/api/post/secret");
    expect(response.status).toBe(status);
    expectPrivate(response);
    expect(put).not.toHaveBeenCalled();
  });

  it("preserves anonymous static cache hits for asset files", async () => {
    const path = "/assets/app.js";
    const app = new Hono();
    app.use("*", cacheMiddleware);
    app.get("*", (c) => c.text("origin"));
    const response = await app.request(path);
    expect(await response.text()).toBe("old private body");
    expect(match).toHaveBeenCalledOnce();
    expect(response.headers.has("CDN-Cache-Control")).toBe(false);
  });

  it("bypasses shared cache for image media paths", async () => {
    const app = new Hono();
    app.use("*", cacheMiddleware);
    app.get("*", (c) => c.text("fresh media"));
    const response = await app.request("/images/photo.webp");
    expect(await response.text()).toBe("fresh media");
    expectPrivate(response);
    expect(match).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("preserves immutable headers on anonymous static cache misses", async () => {
    match.mockResolvedValue(undefined);
    const app = new Hono();
    app.use("*", cacheMiddleware);
    app.get("*", (c) => c.text("static", 200, {
      "Cache-Control": "public, max-age=31536000, immutable",
    }));
    const waitUntil = vi.fn();
    const response = await app.request("/assets/app.js", undefined, {}, {
      waitUntil,
      passThroughOnException: vi.fn(),
      props: {},
      exports: {},
    } as unknown as ExecutionContext);
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(put).toHaveBeenCalledOnce();
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it("keeps route-local validation and error responses private without the outer cache layer", async () => {
    const app = new Hono();
    app.use("*", privateNoStoreMiddleware);
    app.get("*", (c) => c.json({ error: "invalid input" }, 400));
    expectPrivate(await app.request("/"));
  });
});
