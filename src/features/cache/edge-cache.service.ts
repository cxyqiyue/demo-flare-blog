import type { z } from "zod";
import type { Duration } from "@/lib/duration";
import { ms } from "@/lib/duration";
import { getVersion } from "./cache.service";
import { serializeKey } from "./cache.utils";
import type { CacheKey, CacheNamespace } from "./types";

// Cache API 需要合法的 http(s) URL 作为缓存键；用保留性伪域名与真实站点隔离
const EDGE_CACHE_ORIGIN = "https://edge-cache.flare-stack.internal";

/** Cache API 对 max-age 过小的响应不保证存储，统一钳制到 60s */
const MIN_TTL_SECONDS = 60;

function edgeCacheRequest(key: CacheKey): Request {
  return new Request(`${EDGE_CACHE_ORIGIN}/${serializeKey(key)}`);
}

function defaultCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

/**
 * 基于 Cache API（caches.default）的 JSON 缓存。
 *
 * 与 KV 缓存的区别：
 * - 完全免费，不消耗 KV 读/写/删除配额 —— 适合浏览量、动态分页这类
 *   高频短 TTL 的公开读缓存；
 * - 按 PoP（colocation）各自独立，跨节点存在短暂不一致；
 * - 无法主动按 key 失效，需要变更感知时配合 CacheService.getVersion
 *   把 generation 写进缓存键（见 getVersionedJson）。
 */
export async function getJson<T extends z.ZodTypeAny>(
  context: BaseContext & { executionCtx: ExecutionContext },
  key: CacheKey,
  schema: T,
  fetcher: () => Promise<z.infer<T>>,
  options: { ttl?: Duration } = {},
): Promise<z.infer<T>> {
  const { ttl = "5m" } = options;
  const cache = defaultCache();
  const request = edgeCacheRequest(key);

  try {
    const cached = await cache.match(request);
    if (cached) {
      const parsed = schema.safeParse(await cached.json());
      if (parsed.success) return parsed.data;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "edge cache get failed",
        key: serializeKey(key),
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  const data = await fetcher();
  if (data === null || data === undefined) return data;

  context.executionCtx.waitUntil(
    (async () => {
      try {
        const ttlSeconds = Math.max(
          MIN_TTL_SECONDS,
          Math.floor(ms(ttl) / 1000),
        );
        await cache.put(
          request,
          new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${ttlSeconds}`,
            },
          }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            message: "edge cache put failed",
            key: serializeKey(key),
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    })(),
  );

  return data;
}

/**
 * 带 KV generation 指针的边缘缓存：数据本体存 Cache API（零配额），
 * 仅版本指针走 KV（读多写少），发布/更新后 bump 版本即可让旧数据自然过期。
 */
export async function getVersionedJson<T extends z.ZodTypeAny>(
  context: BaseContext & { executionCtx: ExecutionContext },
  namespace: CacheNamespace,
  keyForVersion: (version: string) => CacheKey,
  schema: T,
  fetcher: () => Promise<z.infer<T>>,
  options: { ttl?: Duration } = {},
): Promise<z.infer<T>> {
  let version: string;
  try {
    version = await getVersion(context, namespace);
  } catch {
    return await fetcher();
  }

  return getJson(context, keyForVersion(version), schema, fetcher, options);
}
