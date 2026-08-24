import { createTestContext, waitForBackgroundTasks } from "tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as CacheService from "@/features/cache/cache.service";
import * as EdgeCacheService from "@/features/cache/edge-cache.service";
import { CACHE_NAMESPACES } from "@/features/cache/types";

/**
 * EdgeCacheService锛圕ache API 鍚庡瀛樺偍锛夐泦鎴愭祴璇? *
 * 閲嶇偣楠岃瘉锛氭暟鎹湰浣撲笉钀?KV锛堥浂 KV 鍐欏叆锛夈€佺増鏈寚閽堜粛鐢?KV 鎺у埗銆? */

const PayloadSchema = z.object({ items: z.array(z.string()) });

function edgeTestRequest(path: string): Request {
  return new Request(`https://edge-cache.flare-stack.internal/${path}`);
}

describe("EdgeCacheService.getJson", () => {
  let context: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    context = createTestContext();
    vi.spyOn(context.env.KV, "put");
  });

  it("caches fetcher output in Cache API and never writes payload to KV", async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: ["a", "b"] });
    const key = ["edge-cache-test", "basic"] as const;

    const first = await EdgeCacheService.getJson(
      context,
      key,
      PayloadSchema,
      fetcher,
      { ttl: "5m" },
    );
    await waitForBackgroundTasks(context.executionCtx);

    const second = await EdgeCacheService.getJson(
      context,
      key,
      PayloadSchema,
      fetcher,
      { ttl: "5m" },
    );

    expect(first).toEqual({ items: ["a", "b"] });
    expect(second).toEqual({ items: ["a", "b"] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(context.env.KV.put).not.toHaveBeenCalled();
  });

  it("refetches when cached value fails schema validation", async () => {
    // 鐩存帴鍚?Cache API 濉炰竴浠戒笉绗﹀悎 schema 鐨勮剰鏁版嵁
    const cache = (caches as unknown as { default: Cache }).default;
    await cache.put(
      edgeTestRequest("edge-cache-test:dirty"),
      Response.json({ unexpected: true }),
    );

    const fetcher = vi.fn().mockResolvedValue({ items: ["fresh"] });
    const data = await EdgeCacheService.getJson(
      context,
      ["edge-cache-test", "dirty"],
      PayloadSchema,
      fetcher,
      { ttl: "5m" },
    );

    expect(data).toEqual({ items: ["fresh"] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns null without caching when fetcher yields null", async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const data = await EdgeCacheService.getJson(
      context,
      ["edge-cache-test", "nullish"],
      PayloadSchema,
      fetcher,
      { ttl: "5m" },
    );
    expect(data).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("EdgeCacheService.getVersionedJson", () => {
  let context: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    context = createTestContext();
    vi.spyOn(context.env.KV, "put");
  });

  it("stores data per generation and refetches after bumpVersion (payload stays out of KV)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ items: ["v1-item"] })
      .mockResolvedValueOnce({ items: ["v2-item"] });
    const keyFor = (version: string) =>
      ["edge-cache-test", "versioned", version] as const;

    const first = await EdgeCacheService.getVersionedJson(
      context,
      CACHE_NAMESPACES.MOMENTS_PAGE,
      keyFor,
      PayloadSchema,
      fetcher,
      { ttl: "5m" },
    );
    await waitForBackgroundTasks(context.executionCtx);

    const cachedAgain = await EdgeCacheService.getVersionedJson(
      context,
      CACHE_NAMESPACES.MOMENTS_PAGE,
      keyFor,
      PayloadSchema,
      fetcher,
      { ttl: "5m" },
    );
    expect(first).toEqual({ items: ["v1-item"] });
    expect(cachedAgain).toEqual({ items: ["v1-item"] });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await CacheService.bumpVersion(context, CACHE_NAMESPACES.MOMENTS_PAGE);

    const afterBump = await EdgeCacheService.getVersionedJson(
      context,
      CACHE_NAMESPACES.MOMENTS_PAGE,
      keyFor,
      PayloadSchema,
      fetcher,
      { ttl: "5m" },
    );
    await waitForBackgroundTasks(context.executionCtx);

    expect(afterBump).toEqual({ items: ["v2-item"] });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(context.env.KV.put).toHaveBeenCalledTimes(1);
  });
});
