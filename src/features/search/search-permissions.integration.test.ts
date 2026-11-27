import { getByID } from "@orama/orama";
import { eq } from "drizzle-orm";
import { createTestContext, testRequest } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import searchRoute from "./api/hono/search.route";
import { createMyDb } from "./model/schema";
import { getOramaDb, persistOramaDb } from "./model/store";
import * as SearchService from "./service/search.service";
import { PostsTable } from "@/lib/db/schema";

describe("search current public access", () => {
  it.each([
    { label: "private", update: { visibility: "private" as const } },
    { label: "password", update: { visibility: "password" as const } },
    { label: "draft", update: { status: "draft" as const } },
    { label: "future", update: { publishedAt: new Date(Date.now() + 86_400_000) } },
    { label: "unscheduled", update: { publishedAt: null } },
  ])("rejects stale indexed text after a post becomes $label", async ({ update }) => {
    const context = createTestContext();
    await persistOramaDb(context.env, await createMyDb());
    const [post] = await context.db.insert(PostsTable).values({
      title: "PermissionMarker", slug: "permission-marker",
      summary: "PermissionMarker old summary", status: "published",
      visibility: "public", publishedAt: new Date(Date.now() - 10_000),
    }).returning();
    await SearchService.upsert(context, {
      id: post.id, title: post.title, slug: post.slug, summary: post.summary,
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "PermissionMarker old public body" },
      ] }] }, tags: [],
    }, { immediate: true });
    const query = { q: "PermissionMarker", v: "old-version", limit: 10 };
    expect(await SearchService.search(context, query)).toHaveLength(1);

    // Deliberately leave the index untouched to simulate failed/delayed invalidation.
    await context.db.update(PostsTable).set(update).where(eq(PostsTable.id, post.id));
    expect(getByID(await getOramaDb(context.env), String(post.id))).toBeDefined();
    expect(await SearchService.search(context, query)).toEqual([]);
    const response = await testRequest(searchRoute, "/?q=PermissionMarker&v=old-version", {}, context.env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual([]);
  });

  it("rejects deleted rows and treats repeated immediate index deletion as success", async () => {
    const context = createTestContext();
    await persistOramaDb(context.env, await createMyDb());
    const [post] = await context.db.insert(PostsTable).values({
      title: "DeletedMarker", slug: "deleted-marker", status: "published",
      visibility: "public", publishedAt: new Date(Date.now() - 10_000),
    }).returning();
    await SearchService.upsert(context, {
      id: post.id, title: post.title, slug: post.slug, summary: "old secret",
      contentJson: null, tags: [],
    }, { immediate: true });
    await context.db.delete(PostsTable).where(eq(PostsTable.id, post.id));
    expect(await SearchService.search(context, { q: "DeletedMarker", v: "1", limit: 10 })).toEqual([]);
    await SearchService.deleteIndex(context, { id: post.id }, { immediate: true });
    await expect(SearchService.deleteIndex(context, { id: post.id }, { immediate: true })).resolves.toEqual({ id: post.id });
    expect(getByID(await getOramaDb(context.env), String(post.id))).toBeUndefined();
  });
});
