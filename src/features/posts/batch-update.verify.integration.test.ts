import {
  createAdminTestContext,
  seedUser,
} from "tests/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import * as PostRepo from "@/features/posts/data/posts.data";
import * as PostService from "@/features/posts/services/posts.service";
import { unwrap } from "@/lib/errors";

describe("Batch update posts status verification", () => {
  let adminContext: ReturnType<typeof createAdminTestContext>;

  beforeEach(async () => {
    adminContext = createAdminTestContext();
    await seedUser(adminContext.db, adminContext.session.user);
  });

  it("batch publish flips status to published and keeps updatedAt/publishedAt semantics", async () => {
    const { id: a } = await PostService.createEmptyPost(adminContext);
    const { id: b } = await PostService.createEmptyPost(adminContext);
    await PostService.updatePost(adminContext, {
      id: a,
      data: { title: "A", slug: "a" },
    });
    await PostService.updatePost(adminContext, {
      id: b,
      data: { title: "B", slug: "b" },
    });

    const beforeA = await PostRepo.findPostById(adminContext.db, a);
    const beforeB = await PostRepo.findPostById(adminContext.db, b);
    expect(beforeA?.status).toBe("draft");
    expect(beforeA?.publishedAt).toBeNull();
    expect(beforeB?.status).toBe("draft");
    expect(beforeB?.publishedAt).toBeNull();

    const result = unwrap(
      await PostService.batchUpdatePostsStatus(adminContext, {
        ids: [a, b],
        status: "published",
      }),
    );
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);

    const afterA = await PostRepo.findPostById(adminContext.db, a);
    const afterB = await PostRepo.findPostById(adminContext.db, b);

    expect(afterA?.status).toBe("published");
    expect(afterB?.status).toBe("published");
    expect(afterA?.publishedAt).not.toBeNull();
    expect(afterA?.updatedAt?.getTime()).toBe(beforeA?.updatedAt?.getTime());
    expect(afterB?.updatedAt?.getTime()).toBe(beforeB?.updatedAt?.getTime());

    const draftResult = unwrap(
      await PostService.batchUpdatePostsStatus(adminContext, {
        ids: [a, b],
        status: "draft",
      }),
    );
    expect(draftResult.updated).toBe(2);

    const backA = await PostRepo.findPostById(adminContext.db, a);
    expect(backA?.status).toBe("draft");

    const idempotent = unwrap(
      await PostService.batchUpdatePostsStatus(adminContext, {
        ids: [a, b],
        status: "draft",
      }),
    );
    expect(idempotent.updated).toBe(0);
    expect(idempotent.skipped).toBe(2);
  });
});
