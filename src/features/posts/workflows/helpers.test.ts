import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ upsert: vi.fn(), deleteIndex: vi.fn() }));
vi.mock("@/features/search/service/search.service", () => search);
vi.mock("@/features/posts/services/posts.service", () => ({}));
vi.mock("@/features/cache/cache.service", () => ({}));
vi.mock("@/lib/db", () => ({}));
vi.mock("@/lib/invalidate", () => ({}));

import { upsertPostSearchIndex } from "./helpers";

describe("workflow index visibility transitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["private", "password"])(
    "deletes the former public document when visibility becomes %s",
    async (visibility) => {
      const env = {} as Env;
      const flushPromise = Promise.resolve();
      search.deleteIndex.mockResolvedValue({ id: 42, flushPromise });
      const result = await upsertPostSearchIndex(env, {
        id: 42, slug: "formerly-public", visibility, title: "Old public title",
        summary: "Old public summary", contentJson: null, tags: [],
      });

      expect(search.deleteIndex).toHaveBeenCalledWith({ env }, { id: 42 });
      expect(search.upsert).not.toHaveBeenCalled();
      expect(result.flushPromise).toBe(flushPromise);
    },
  );
});
