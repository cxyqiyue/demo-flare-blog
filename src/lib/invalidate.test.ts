import { afterEach, describe, expect, it, vi } from "vitest";
import { purgePostCDNCache } from "./invalidate";

vi.mock("@/lib/env/server.env", () => ({
  serverEnv: (env: Env) => env,
  isNotInProduction: () => false,
}));

afterEach(() => vi.unstubAllGlobals());

describe("post CDN invalidation", () => {
  it("purges old feed bodies and other posts that reference a changed post", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await purgePostCDNCache({
      DOMAIN: "example.com", CLOUDFLARE_ZONE_ID: "test-zone",
      CLOUDFLARE_PURGE_API_TOKEN: "test-token",
    } as Env, "changed-post");

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.files).toEqual(expect.arrayContaining([
      "https://example.com/feed.json", "https://example.com/rss.xml",
      "https://example.com/atom.xml", "https://example.com/sitemap.xml",
      "https://example.com/api/post/changed-post/adjacent",
    ]));
    expect(payload.prefixes).toEqual(expect.arrayContaining([
      "example.com/api/post", "example.com/post", "example.com/api/search",
    ]));
  });
});
