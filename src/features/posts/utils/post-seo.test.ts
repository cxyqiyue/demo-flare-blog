import { describe, expect, it } from "vitest";
import { buildPostHead } from "./post-seo";

const publicPost = {
  slug: "post",
  title: "Sensitive title",
  summary: "Sensitive summary",
  visibility: "public" as const,
  gate: null,
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  tags: [{ id: 1, name: "tag" }],
};
const input = {
  authorName: "Author",
  canonicalHref: "https://example.com/post/post",
};

describe("post SEO access policy", () => {
  it("publishes metadata and Article JSON-LD for unrestricted public content", () => {
    const head = buildPostHead({ ...input, post: { ...publicPost, tags: [] } });
    expect(head.meta).toContainEqual({ title: publicPost.title });
    expect(head.meta).toContainEqual({ name: "description", content: publicPost.summary });
    expect(head.meta.some((meta) => "name" in meta && meta.name === "robots")).toBe(false);
    expect(JSON.parse(head.scripts[0].children)).toMatchObject({
      "@type": "Article",
      headline: publicPost.title,
      description: publicPost.summary,
    });
  });

  it("does not disclose private shell metadata even if upstream supplied it", () => {
    const head = buildPostHead({
      ...input,
      post: { ...publicPost, tags: [], visibility: "private", gate: "private" },
    });
    const serialized = JSON.stringify(head);
    expect(serialized).not.toContain(publicPost.title);
    expect(serialized).not.toContain(publicPost.summary);
    expect(head.scripts).toEqual([]);
    expect(head.meta).toContainEqual({
      name: "robots", content: "noindex, nofollow, noarchive",
    });
  });

  it.each(["private", "password"] as const)("does not index authorized %s content", (visibility) => {
    const head = buildPostHead({
      ...input,
      post: { ...publicPost, tags: [], visibility, gate: null },
    });
    expect(head.meta).toContainEqual({ title: publicPost.title });
    expect(head.meta).toContainEqual({
      name: "robots", content: "noindex, nofollow, noarchive",
    });
    expect(JSON.stringify(head)).not.toContain(publicPost.summary);
    expect(head.scripts).toEqual([]);
  });

  it("allows a password title but withholds summary and Article JSON-LD", () => {
    const head = buildPostHead({
      ...input,
      post: { ...publicPost, tags: [], visibility: "password", gate: "password" },
    });
    expect(head.meta).toContainEqual({ property: "og:title", content: publicPost.title });
    expect(JSON.stringify(head)).not.toContain(publicPost.summary);
    expect(head.scripts).toEqual([]);
  });

  it("fails closed when a gate and visibility disagree", () => {
    const head = buildPostHead({ ...input, post: { ...publicPost, tags: [], gate: "private" } });
    expect(JSON.stringify(head)).not.toContain(publicPost.title);
    expect(head.scripts).toEqual([]);
  });
});
