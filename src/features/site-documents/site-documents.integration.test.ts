import { eq } from "drizzle-orm";
import { createTestContext, testRequest } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import { PostsTable } from "@/lib/db/schema";
import siteDocumentsRoute from "./api/hono/site-documents.route";
import { buildAtomXml, buildFeedJson, buildRssXml, buildSitemapXml } from "./service/site-documents.service";

describe("site document visibility transitions", () => {
  it.each(["private", "password"] as const)(
    "drops previously generated public bodies after visibility becomes %s",
    async (visibility) => {
      const context = createTestContext();
      const marker = "OldPublicFeedSecret";
      const slug = "formerly-public-feed";
      const [post] = await context.db.insert(PostsTable).values({
        title: "Formerly public feed entry", slug, summary: marker,
        status: "published", visibility: "public",
        publishedAt: new Date(Date.now() - 10_000),
        contentJson: { type: "doc", content: [{ type: "paragraph", content: [
          { type: "text", text: `${marker} body` },
        ] }] },
      }).returning();
      const documents = [
        { path: "/feed.json", build: buildFeedJson },
        { path: "/rss.xml", build: buildRssXml },
        { path: "/atom.xml", build: buildAtomXml },
        { path: "/sitemap.xml", build: buildSitemapXml },
      ];

      for (const { path } of documents) {
        const response = await testRequest(siteDocumentsRoute, path, {}, context.env);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain(slug);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      }

      await context.db.update(PostsTable).set({ visibility }).where(eq(PostsTable.id, post.id));

      for (const { path, build } of documents) {
        // Covers the shared builders used by server rendering as well as HTTP.
        const generated = await build(context.env, context.executionCtx);
        expect(generated).not.toContain(marker);
        expect(generated).not.toContain(slug);
        const response = await testRequest(siteDocumentsRoute, path, {}, context.env);
        const body = await response.text();
        expect(body).not.toContain(marker);
        expect(body).not.toContain(slug);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        const head = await testRequest(siteDocumentsRoute, path, { method: "HEAD" }, context.env);
        expect(head.headers.get("Cache-Control")).toBe("no-store");
      }
    },
  );
});
