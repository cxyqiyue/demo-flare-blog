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
    cfg.publicUrl?.trim() ||
    `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}`
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
): Promise<Result<S3ListObjectsResult, { reason: "S3_LIST_FAILED"; message: string }>> {
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
): Promise<Result<{ success: boolean }, { reason: "S3_DELETE_FAILED"; message: string }>> {
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
): Promise<Result<{ deleted: number }, { reason: "S3_DELETE_FAILED"; message: string }>> {
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
): Promise<Result<{ success: boolean }, { reason: "S3_RENAME_FAILED"; message: string }>> {
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
): Promise<Result<{ success: boolean }, { reason: "S3_MOVE_FAILED"; message: string }>> {
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
      if (result.error) return err({ reason: "S3_LIST_FAILED", message: result.error.message });
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
): Promise<Result<{ moved: number }, { reason: "S3_MOVE_FAILED"; message: string }>> {
  let moved = 0;
  for (const { oldKey, newKey } of keys) {
    const result = await moveS3Object(cfg, oldKey, newKey);
    if (result.error) return err({ reason: "S3_MOVE_FAILED", message: result.error.message });
    moved++;
  }
  return ok({ moved });
}

// ── Upload for Media Library ──────────────────────────────────

export async function uploadToS3ForMediaLibrary(
  cfg: S3Config,
  file: File,
  folder: string,
): Promise<Result<
  { key: string; url: string; fileName: string; mimeType: string; sizeInBytes: number },
  { reason: "S3_UPLOAD_FAILED"; message: string }
>> {
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
    return err({ reason: "S3_UPLOAD_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
}
