import {
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
    const bucketPrefix = [cfg.pathPrefix?.trim(), options.prefix].filter(Boolean).join("/");

    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: bucketPrefix || undefined,
        Delimiter: options.delimiter || undefined,
        ContinuationToken: options.continuationToken || undefined,
        MaxKeys: options.maxKeys ?? 1000,
      }),
    );

    const normalizedPrefix = (bucketPrefix || "").replace(/\/+$/, "");
    const strippedPrefix = normalizedPrefix ? `${normalizedPrefix}/` : "";
    const stripPrefix = (key: string) =>
      key.startsWith(strippedPrefix) ? key.slice(strippedPrefix.length) : key;

    const objects = (response.Contents ?? []).map((o) => ({
      key: stripPrefix(o.Key ?? ""),
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? "",
    }));

    const prefixes = (response.CommonPrefixes ?? [])
      .map((p) => stripPrefix((p.Prefix ?? "").replace(/\/$/, "")))
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
    const fullKey = [cfg.pathPrefix?.trim(), key].filter(Boolean).join("/");

    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: fullKey,
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
    const objectKey = [cfg.pathPrefix?.trim(), folder, baseName].filter(Boolean).join("/");

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
