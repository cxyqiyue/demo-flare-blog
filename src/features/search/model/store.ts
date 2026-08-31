import type { RawData } from "@orama/orama";
import { load, save } from "@orama/orama";
import { eq } from "drizzle-orm";
import { guardedKvPut } from "@/features/cache/kv-write-guard";
import type { MyOramaDB } from "@/features/search/model/schema";
import { createMyDb } from "@/features/search/model/schema";
import { getDb } from "@/lib/db";
import { SearchIndexShardsTable } from "@/lib/db/schema";

const KV_KEY = "search:index:v3";
const KV_META_KEY = "search:index:meta:v3";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function compressRaw(raw: RawData): Promise<Uint8Array> {
  // Prefer built-in compression to avoid extra deps; fall back to plain bytes if unsupported
  const json = JSON.stringify(raw);
  const encoded = textEncoder.encode(json);

  if (typeof CompressionStream === "undefined") {
    return encoded;
  }

  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(encoded);
  await writer.close();
  const compressed = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(compressed);
}

async function decompressToRaw(buffer: ArrayBuffer | Uint8Array): Promise<RawData> {
  const bytes = new Uint8Array(buffer);
  // Attempt gzip first; if it fails, treat as plain JSON string (back-compat)
  const tryGzip = async () => {
    if (typeof DecompressionStream === "undefined") {
      throw new TypeError("DecompressionStream unavailable");
    }

    const stream = new DecompressionStream("gzip");
    const writer = stream.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    const decompressed = await new Response(stream.readable).arrayBuffer();
    const json = textDecoder.decode(decompressed);
    return JSON.parse(json) as RawData;
  };

  try {
    return await tryGzip();
  } catch {
    const json = textDecoder.decode(bytes);
    return JSON.parse(json) as RawData;
  }
}

// ── D1 分片存储（KV 降级时的权威后端） ──────────────────────
// D1 单 cell 上限 ~1MB，索引 gzip 后可能较大，故按 ~400KB base64 分片。
const SHARD_CHUNK_CHARS = 400_000;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function saveIndexToD1(
  env: Env,
  shardKey: string,
  data: Uint8Array | string,
): Promise<void> {
  const db = getDb(env);
  const payload = typeof data === "string" ? data : uint8ArrayToBase64(data);
  const chunks: string[] = [];
  for (let i = 0; i < payload.length; i += SHARD_CHUNK_CHARS) {
    chunks.push(payload.slice(i, i + SHARD_CHUNK_CHARS));
  }

  // 事务性替换：先删旧分片，再写新分片（使用 db.batch 保证一次往返）
  const del = db
    .delete(SearchIndexShardsTable)
    .where(eq(SearchIndexShardsTable.shardKey, shardKey));
  const rows = chunks.map((data, i) => ({
    shardKey,
    shardIndex: i,
    data,
  }));
  if (rows.length === 0) {
    await del.run();
    return;
  }
  const ins = db.insert(SearchIndexShardsTable).values(rows);
  await db.batch([del, ins]);
}

async function loadIndexFromD1(
  env: Env,
  shardKey: string,
  isMeta: boolean,
): Promise<Uint8Array | string | null> {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(SearchIndexShardsTable)
    .where(eq(SearchIndexShardsTable.shardKey, shardKey))
    .orderBy(SearchIndexShardsTable.shardIndex);
  if (rows.length === 0) return null;
  const payload = rows.map((r) => r.data).join("");
  if (isMeta) return payload; // meta 存的是 JSON 字符串
  return base64ToUint8Array(payload);
}

let cachedDb: MyOramaDB | null = null;
let cachedVersion: string | null = null;
let inflight: Promise<MyOramaDB> | null = null;

// --- 延迟持久化：合并短时间内的多次写入，减少后端写入次数 ---
let dirtyDb: MyOramaDB | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DEBOUNCE_MS = 5_000;

async function flushToBackend(env: Env, db: MyOramaDB) {
  const raw = save(db);
  const compressed = await compressRaw(raw);

  const newVersion = Date.now().toString();
  const meta = {
    version: newVersion,
    updatedAt: new Date().toISOString(),
    sizeInBytes: compressed.byteLength,
  };

  // KV 写入通过写入保护层：可用则写（快捷读取），否则跳过
  await guardedKvPut(env, KV_KEY, compressed);
  await guardedKvPut(env, KV_META_KEY, JSON.stringify(meta));

  // 始终写入 D1 分片作为权威降级后端
  try {
    await saveIndexToD1(env, KV_KEY, compressed);
    await saveIndexToD1(env, KV_META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "orama D1 shard persist failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  setOramaDb(db, newVersion);
}

async function loadFromBackend(env: Env): Promise<MyOramaDB | null> {
  // 优先 KV（快）；KV 无数据则回退 D1 分片
  let buf: ArrayBuffer | Uint8Array | null = null;
  try {
    buf = await env.KV.get(KV_KEY, "arrayBuffer");
  } catch {
    buf = null;
  }

  if (!buf) {
    try {
      const d1Data = await loadIndexFromD1(env, KV_KEY, false);
      buf = d1Data as Uint8Array | null;
    } catch (err) {
      console.error(
        JSON.stringify({
          message: "orama D1 shard load failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  if (!buf) return null;

  try {
    const raw = await decompressToRaw(buf);
    const db = await createMyDb();
    await load(db, raw);
    return db;
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "orama index load failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

export async function getOramaDb(env: Env): Promise<MyOramaDB> {
  const meta = await getOramaMeta(env);
  const latestVersion = meta?.version || "init";

  if (cachedDb && cachedVersion === latestVersion) return cachedDb;
  if (inflight) return inflight;

  inflight = (async () => {
    const fromBackend = await loadFromBackend(env);
    if (fromBackend) return fromBackend;
    return await createMyDb();
  })().finally(() => {
    inflight = null;
  });

  cachedDb = await inflight;
  cachedVersion = latestVersion;
  return cachedDb;
}

/**
 * 立即持久化搜索索引（用于需要确保写入的场景，如 rebuildIndex）。
 */
export async function persistOramaDb(env: Env, db: MyOramaDB) {
  // 取消任何待执行的延迟写入，因为即将立即写入
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  dirtyDb = null;

  const raw = save(db);
  const compressed = await compressRaw(raw);

  const newVersion = Date.now().toString();

  const meta = {
    version: newVersion,
    updatedAt: new Date().toISOString(),
    sizeInBytes: compressed.byteLength,
  };

  await guardedKvPut(env, KV_KEY, compressed);
  await guardedKvPut(env, KV_META_KEY, JSON.stringify(meta));

  try {
    await saveIndexToD1(env, KV_KEY, compressed);
    await saveIndexToD1(env, KV_META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "orama D1 shard persist (immediate) failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  setOramaDb(db, newVersion);
  return newVersion;
}

/**
 * 延迟持久化搜索索引：合并短时间内的多次写入（如 Workflow 中的
 * upsert + delete），仅在最后一次写入后 ~5s 才实际持久化，
 * 显著减少发布流程中的后端写入次数。
 *
 * 返回 Promise，调方可通过 executionCtx.waitUntil() 保持 Worker 存活。
 */
export function persistOramaDbDeferred(env: Env, db: MyOramaDB): Promise<void> {
  dirtyDb = db;
  dirtyEnv = env;
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  return new Promise<void>((resolve) => {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushToBackend(dirtyEnv!, dirtyDb!)
        .then(() => resolve())
        .catch((err) => {
          console.error(
            JSON.stringify({
              message: "deferred orama flush failed",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          resolve();
        });
    }, FLUSH_DEBOUNCE_MS);
  });
}

let dirtyEnv: Env | null = null;

export async function getOramaMeta(
  env: Env,
): Promise<{ version: string } | null> {
  // 优先 KV，KV 无则读 D1 meta
  try {
    const kvMeta = await env.KV.get(KV_META_KEY, "json");
    if (kvMeta) return kvMeta as { version: string };
  } catch {
    // ignore, fall through to D1
  }
  try {
    const d1Meta = await loadIndexFromD1(env, KV_META_KEY, true);
    if (d1Meta) {
      try {
        return JSON.parse(d1Meta as string) as { version: string };
      } catch {
        return null;
      }
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "orama D1 meta load failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  return null;
}

export function setOramaDb(db: MyOramaDB, version: string) {
  cachedDb = db;
  cachedVersion = version;
}
