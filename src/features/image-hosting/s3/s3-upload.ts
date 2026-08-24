// Cloudflare Workers polyfill — AWS SDK v3 calls process.emitWarning
// which does not exist in the Workers runtime.
if (typeof globalThis.process === "undefined") {
  (globalThis as unknown as Record<string, unknown>).process = {
    emitWarning() {},
  };
} else if (typeof globalThis.process.emitWarning !== "function") {
  Object.defineProperty(globalThis.process, "emitWarning", {
    value: () => {},
    writable: true,
    configurable: true,
  });
}

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { err, ok, type Result } from "@/lib/errors";

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix: string;
  publicUrl: string;
  pathStyle?: boolean;
}

/** @deprecated Use S3Config */
export type S3UploadConfig = S3Config;

/**
 * 从系统配置的 imageHosting.s3 段解析出可用的 S3 连接配置。
 * 所有路径（编辑器上传、媒体库管理、图床代理读取、审查后清理）必须共用此函数，
 * 确保 region/pathStyle 等默认值完全一致 —— 各处默认值不一致会导致
 * 上传与读取使用不同的签名作用域（region），从而出现"上传成功但代理读取 502"。
 */
export function resolveValidatedS3Config(
  s3:
    | {
        endpoint?: string | null;
        bucket?: string | null;
        region?: string | null;
        accessKeyId?: string | null;
        secretAccessKey?: string | null;
        pathPrefix?: string | null;
        publicUrl?: string | null;
        pathStyle?: boolean | null;
      }
    | undefined
    | null,
): S3Config | null {
  const endpoint = s3?.endpoint?.trim();
  const bucket = s3?.bucket?.trim();
  const accessKeyId = s3?.accessKeyId?.trim();
  const secretAccessKey = s3?.secretAccessKey?.trim();
  if (!s3 || !endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    // 留空时由 createS3Client 统一映射为 "auto"，与已验证可用的上传路径一致
    region: s3.region?.trim() || "",
    accessKeyId,
    secretAccessKey,
    pathPrefix: s3.pathPrefix?.trim() || "",
    publicUrl: s3.publicUrl?.trim() || "",
    pathStyle: s3.pathStyle ?? false,
  };
}

export interface S3UploadInput {
  key: string;
  body: ArrayBuffer;
  contentType: string;
}

function createS3Client(cfg: S3Config): S3Client {
  return new S3Client({
    region: cfg.region?.trim() || "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: cfg.pathStyle ?? true,
  });
}

function encodeObjectKey(key: string): string {
  return key.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function buildPublicUrl(cfg: S3Config, key: string): string {
  const base = (
    cfg.publicUrl?.trim() || `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}`
  ).replace(/\/+$/, "");
  return `${base}/${encodeObjectKey(key)}`;
}

// ── Upload ────────────────────────────────────────────────────

export type S3UploadResult = Result<
  { url: string },
  { reason: "PROVIDER_REQUEST_FAILED"; message: string }
>;

export async function uploadToS3(
  cfg: S3UploadConfig,
  input: S3UploadInput,
): Promise<S3UploadResult> {
  try {
    const client = createS3Client(cfg);

    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: input.key,
        Body: new Uint8Array(input.body),
        ContentType: input.contentType,
      }),
    );

    return ok({ url: buildPublicUrl(cfg, input.key) });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Authenticated Read (proxy upstream) ───────────────────────

/** 超过该大小的对象改用流式转发，避免缓冲占用过多 Worker 内存 */
const S3_PROXY_BUFFER_LIMIT_BYTES = 25 * 1024 * 1024;

interface S3BodyLike {
  transformToByteArray?: () => Promise<Uint8Array>;
  transformToWebStream?: () => unknown;
}

/**
 * 将 GetObject 输出转换为可安全返回给客户端的 Response。
 *
 * 不能把 SDK 的 Body 直接强转成 ReadableStream 塞进 Response：
 * Workers 运行时下该对象可能不是可用流（或为 undefined），会构造出
 * "200 + 空响应体"的静默坏图。因此这里：
 * - Body 缺失 → 抛错，由调用方转成明确的 502；
 * - 小对象（≤ 限制值）缓冲为完整字节，彻底规避流式转发截断；
 * - 大对象经 transformToWebStream 流式转发。
 */
export async function s3ObjectBodyToResponse(
  body: unknown,
  meta: { contentType?: string; contentLength?: number; etag?: string },
): Promise<Response> {
  if (!body || typeof body !== "object") {
    throw new Error("S3 object body is empty");
  }

  const headers = new Headers();
  if (meta.contentType) headers.set("content-type", meta.contentType);
  if (meta.contentLength != null) {
    headers.set("content-length", String(meta.contentLength));
  }
  if (meta.etag) headers.set("etag", meta.etag);

  const sdkBody = body as S3BodyLike;
  const withinBufferLimit =
    meta.contentLength == null ||
    meta.contentLength <= S3_PROXY_BUFFER_LIMIT_BYTES;

  if (withinBufferLimit && typeof sdkBody.transformToByteArray === "function") {
    const bytes = await sdkBody.transformToByteArray();
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers,
    });
  }

  if (typeof sdkBody.transformToWebStream === "function") {
    const stream = sdkBody.transformToWebStream();
    if (stream) {
      return new Response(stream as ReadableStream, { status: 200, headers });
    }
  }

  throw new Error("S3 object body is not readable");
}

/**
 * 经 SigV4 签名回源读取对象（与上传同一条鉴权路径）。
 * 受保护图链模式下，Worker 代理 /media/file/s3/:key 必须用它取内容：
 * 公开读 URL 对私有桶（以及 virtual-host 型端点）会 403/404。
 */
export async function fetchS3ImageStream(
  cfg: S3Config,
  key: string,
): Promise<Result<Response, { reason: string; message: string }>> {
  try {
    const client = createS3Client(cfg);
    const res = await client.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );

    const response = await s3ObjectBodyToResponse(res.Body, {
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      etag: res.ETag,
    });
    return ok(response);
  } catch (error) {
    return err({
      reason: "S3_FETCH_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── List Objects ──────────────────────────────────────────────
// NOTE: All keys/prefixes in this module are FULL bucket-relative paths.
// `cfg.pathPrefix` is treated as a regular visible folder, never prepended
// implicitly — this keeps the media library in true sync with real storage.

export interface S3ListObjectsResult {
  objects: Array<{ key: string; size: number; lastModified: string }>;
  prefixes: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export async function listS3Objects(
  cfg: S3Config,
  options: {
    prefix?: string;
    delimiter?: string;
    continuationToken?: string;
    maxKeys?: number;
  } = {},
): Promise<
  Result<S3ListObjectsResult, { reason: "S3_LIST_FAILED"; message: string }>
> {
  try {
    const client = createS3Client(cfg);

    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: options.prefix || undefined,
        Delimiter: options.delimiter || undefined,
        ContinuationToken: options.continuationToken || undefined,
        MaxKeys: options.maxKeys ?? 1000,
      }),
    );

    const objects = (response.Contents ?? []).map((o) => ({
      key: o.Key ?? "",
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? "",
    }));

    const prefixes = (response.CommonPrefixes ?? [])
      .map((p) => (p.Prefix ?? "").replace(/\/$/, ""))
      .filter(Boolean);

    return ok({
      objects,
      prefixes,
      isTruncated: response.IsTruncated ?? false,
      nextContinuationToken: response.NextContinuationToken,
    });
  } catch (error) {
    return err({
      reason: "S3_LIST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Delete Object ─────────────────────────────────────────────

export async function deleteS3Object(
  cfg: S3Config,
  key: string,
): Promise<
  Result<{ success: boolean }, { reason: "S3_DELETE_FAILED"; message: string }>
> {
  try {
    const client = createS3Client(cfg);

    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );

    return ok({ success: true });
  } catch (error) {
    return err({
      reason: "S3_DELETE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Batch Delete ──────────────────────────────────────────────

export async function deleteS3Objects(
  cfg: S3Config,
  keys: string[],
): Promise<
  Result<{ deleted: number }, { reason: "S3_DELETE_FAILED"; message: string }>
> {
  let deleted = 0;
  for (const key of keys) {
    const result = await deleteS3Object(cfg, key);
    if (result.error) return result;
    deleted++;
  }
  return ok({ deleted });
}

// ── Rename Object (Copy + Delete) ────────────────────────────

export async function renameS3Object(
  cfg: S3Config,
  oldKey: string,
  newKey: string,
): Promise<
  Result<{ success: boolean }, { reason: "S3_RENAME_FAILED"; message: string }>
> {
  try {
    const client = createS3Client(cfg);

    await client.send(
      new CopyObjectCommand({
        Bucket: cfg.bucket,
        CopySource: `/${cfg.bucket}/${encodeObjectKey(oldKey)}`,
        Key: newKey,
      }),
    );

    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: oldKey,
      }),
    );

    return ok({ success: true });
  } catch (error) {
    return err({
      reason: "S3_RENAME_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Move Object (Copy + Delete) ──────────────────────────────

export async function moveS3Object(
  cfg: S3Config,
  oldKey: string,
  newKey: string,
): Promise<
  Result<{ success: boolean }, { reason: "S3_MOVE_FAILED"; message: string }>
> {
  try {
    const client = createS3Client(cfg);

    await client.send(
      new CopyObjectCommand({
        Bucket: cfg.bucket,
        CopySource: `/${cfg.bucket}/${encodeObjectKey(oldKey)}`,
        Key: newKey,
      }),
    );

    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: oldKey,
      }),
    );

    return ok({ success: true });
  } catch (error) {
    return err({
      reason: "S3_MOVE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── List All Keys (for folder operations) ─────────────────────

export async function listAllS3Keys(
  cfg: S3Config,
  prefix: string,
): Promise<Result<string[], { reason: "S3_LIST_FAILED"; message: string }>> {
  try {
    const allKeys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await listS3Objects(cfg, {
        prefix,
        continuationToken,
      });
      if (result.error)
        return err({ reason: "S3_LIST_FAILED", message: result.error.message });
      allKeys.push(...result.data.objects.map((o) => o.key));
      continuationToken = result.data.nextContinuationToken;
    } while (continuationToken);

    return ok(allKeys);
  } catch (error) {
    return err({
      reason: "S3_LIST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Batch Move Objects ────────────────────────────────────────

export async function moveS3Objects(
  cfg: S3Config,
  keys: Array<{ oldKey: string; newKey: string }>,
): Promise<
  Result<{ moved: number }, { reason: "S3_MOVE_FAILED"; message: string }>
> {
  let moved = 0;
  for (const { oldKey, newKey } of keys) {
    const result = await moveS3Object(cfg, oldKey, newKey);
    if (result.error)
      return err({ reason: "S3_MOVE_FAILED", message: result.error.message });
    moved++;
  }
  return ok({ moved });
}

// ── Upload for Media Library ──────────────────────────────────

export async function uploadToS3ForMediaLibrary(
  cfg: S3Config,
  file: File,
  folder: string,
): Promise<
  Result<
    {
      key: string;
      url: string;
      fileName: string;
      mimeType: string;
      sizeInBytes: number;
    },
    { reason: "S3_UPLOAD_FAILED"; message: string }
  >
> {
  try {
    const ext = file.name.split(".").pop() || "bin";
    const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    // `folder` is the exact destination shown in the media library (bucket-relative).
    const objectKey = [folder, baseName].filter(Boolean).join("/");

    const result = await uploadToS3(cfg, {
      key: objectKey,
      body: await file.arrayBuffer(),
      contentType: file.type || "application/octet-stream",
    });

    if (result.error) {
      return err({ reason: "S3_UPLOAD_FAILED", message: result.error.message });
    }

    return ok({
      key: objectKey,
      url: result.data.url,
      fileName: file.name,
      mimeType: file.type,
      sizeInBytes: file.size,
    });
  } catch (error) {
    return err({
      reason: "S3_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
