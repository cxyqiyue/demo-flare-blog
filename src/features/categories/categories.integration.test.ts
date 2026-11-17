import { eq } from "drizzle-orm";
import { createAdminTestContext, seedUser } from "tests/test-utils";
import { describe, expect, it } from "vitest";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as PostService from "@/features/posts/services/posts.service";
import { CategoriesTable, PostCategoriesTable } from "@/lib/db/schema";
import { unwrap } from "@/lib/errors";

describe("category publication", () => {
  it("keeps autosaved assignments private until publishing, including removal", async () => {
    const context = createAdminTestContext();
    await seedUser(context.db, context.session.user);
    const [category] = await context.db
      .insert(CategoriesTable)
      .values({ name: "独立分类" })
      .returning();
    const { id } = await PostService.createEmptyPost(context);
    unwrap(
      await PostService.updatePost(context, {
        id,
        data: {
          title: "分类发布",
          slug: "category-publish",
          status: "published",
          publishedAt: new Date(),
          categoryId: category.id,
        },
      }),
    );
    expect(
      (
        await PostRepo.getPostsCursor(context.db, {
          publicOnly: true,
          categoryName: category.name,
        })
      ).items,
    ).toHaveLength(0);
    await PostService.startPostProcessWorkflow(context, {
      id,
      status: "published",
      clientToday: new Date().toISOString().slice(0, 10),
    });
    expect(
      (
        await PostRepo.getPostsCursor(context.db, {
          publicOnly: true,
          categoryName: category.name,
        })
      ).items.map((post) => post.id),
    ).toEqual([id]);
    unwrap(
      await PostService.updatePost(context, { id, data: { categoryId: null } }),
    );
    expect(
      (await PostRepo.findPostById(context.db, id))?.categoryId,
    ).toBeNull();
    expect(
      (
        await PostRepo.getPostsCursor(context.db, {
          publicOnly: true,
          categoryName: category.name,
        })
      ).items,
    ).toHaveLength(1);
    await PostService.startPostProcessWorkflow(context, {
      id,
      status: "published",
      clientToday: new Date().toISOString().slice(0, 10),
    });
    expect(
      (
        await PostRepo.getPostsCursor(context.db, {
          publicOnly: true,
          categoryName: category.name,
        })
      ).items,
    ).toHaveLength(0);
    const assignment = await context.db
      .select()
      .from(PostCategoriesTable)
      .where(eq(PostCategoriesTable.postId, id))
      .get();
    expect(assignment?.publicCategoryId).toBeNull();
  });
});
