import { err, ok, type Result } from "@/lib/errors";

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix: string;
  publicUrl: string;
}

/** @deprecated Use S3Config */
export type S3UploadConfig = S3Config;

export interface S3UploadInput {
  key: string;
  body: ArrayBuffer;
  contentType: string;
}

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }
  return result;
}

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === "string" ? textEncoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return toHex(new Uint8Array(digest));
}

async function hmacSha256(
  key: ArrayBuffer | Uint8Array | string,
  data: ArrayBuffer | string,
): Promise<Uint8Array> {
  const keyBytes = new Uint8Array(
    typeof key === "string"
      ? textEncoder.encode(key)
      : key instanceof Uint8Array
        ? key
        : new Uint8Array(key),
  ).slice();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const dataBuf = typeof data === "string" ? textEncoder.encode(data) : data;
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, dataBuf));
}

async function hmacSha256Hex(
  key: ArrayBuffer | Uint8Array | string,
  data: ArrayBuffer | string,
): Promise<string> {
  return toHex(await hmacSha256(key, data));
}

function formatAmzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[:-]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * 将对象 key 中的每一段做 URL 编码（保留 `/` 作为路径分隔符）。
 */
function encodeObjectKey(key: string): string {
  return key.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

/**
 * 编码 S3 查询参数值（AWS SigV4 规范）。
 * encodeURIComponent 会将 / 编码为 %2F，但 AWS S3 期望 / 保持原样。
 */
function encodeS3QueryParam(value: string): string {
  return encodeURIComponent(value).replace(/%2f/g, "/");
}

interface SignRequestParams {
  method: string;
  canonicalUri: string;
  canonicalQueryString?: string;
  host: string;
  contentType: string;
  payloadHash: string;
  amzDate: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

async function signRequestV4({
  method,
  canonicalUri,
  canonicalQueryString = "",
  host,
  contentType,
  payloadHash,
  amzDate,
  region,
  accessKeyId,
  secretAccessKey,
}: SignRequestParams): Promise<string> {
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const kDate = await hmacSha256("AWS4" + secretAccessKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256Hex(kSigning, stringToSign);

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

interface SignGetRequestParams {
  canonicalUri: string;
  canonicalQueryString?: string;
  host: string;
  payloadHash: string;
  amzDate: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

async function signGetRequest({
  canonicalUri,
  canonicalQueryString = "",
  host,
  payloadHash,
  amzDate,
  region,
  accessKeyId,
  secretAccessKey,
}: SignGetRequestParams): Promise<string> {
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const kDate = await hmacSha256("AWS4" + secretAccessKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256Hex(kSigning, stringToSign);

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

interface SignDeleteRequestParams {
  canonicalUri: string;
  host: string;
  payloadHash: string;
  amzDate: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

async function signDeleteRequest({
  canonicalUri,
  host,
  payloadHash,
  amzDate,
  region,
  accessKeyId,
  secretAccessKey,
}: SignDeleteRequestParams): Promise<string> {
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `DELETE\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const kDate = await hmacSha256("AWS4" + secretAccessKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256Hex(kSigning, stringToSign);

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export type S3UploadResult = Result<
  { url: string },
  { reason: "PROVIDER_REQUEST_FAILED"; message: string }
>;

/**
 * 使用 AWS Signature V4 将对象上传到任意 S3 兼容存储（路径式寻址）。
 * 兼容 AWS S3、Cloudflare R2、阿里云 OSS、腾讯云 COS、MinIO 等。
 */
export async function uploadToS3(
  cfg: S3UploadConfig,
  input: S3UploadInput,
): Promise<S3UploadResult> {
  try {
    const endpoint = new URL(cfg.endpoint);
    const host = endpoint.host;
    const region = cfg.region?.trim() || "us-east-1";
    const canonicalUri = `/${encodeObjectKey(`${cfg.bucket}/${input.key}`)}`;
    const payloadHash = await sha256Hex(input.body);
    const amzDate = formatAmzDate(new Date());

    const authorization = await signRequestV4({
      method: "PUT",
      canonicalUri,
      host,
      contentType: input.contentType,
      payloadHash,
      amzDate,
      region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    });

    const response = await fetch(`${endpoint.origin}${canonicalUri}`, {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
      body: input.body,
    });

    if (!response.ok) {
      const responseText = await response.text();
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message:
          extractS3ErrorMessage(responseText) || `S3 upload failed with status ${response.status}`,
      });
    }

    const base = (
      cfg.publicUrl?.trim() ||
      `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}`
    ).replace(/\/+$/, "");

    return ok({ url: `${base}/${encodeObjectKey(input.key)}` });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 从 S3 XML 错误响应中提取可读的错误信息。
 * 例如 <Code>SignatureDoesNotMatch</Code><Message>The request signature ...</Message>
 */
function extractS3ErrorMessage(xml: string): string {
  const code = xml.match(/<Code>([^<]*)<\/Code>/)?.[1];
  const message = xml.match(/<Message>([^<]*)<\/Message>/)?.[1];
  if (code && message) return `${code}: ${message}`;
  if (message) return message;
  if (code) return code;
  return xml.slice(0, 500);
}

// ── S3 List Objects ──────────────────────────────────────────

const EMPTY_PAYLOAD_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

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
    const endpoint = new URL(cfg.endpoint);
    const host = endpoint.host;
    const region = cfg.region?.trim() || "us-east-1";
    const amzDate = formatAmzDate(new Date());

    const bucketPrefix = [cfg.pathPrefix?.trim(), options.prefix].filter(Boolean).join("/");

    // 手动构建查询字符串，避免 URLSearchParams 将 / 编码为 %2F 导致签名校验失败
    const queryParams: Array<[string, string]> = [["list-type", "2"]];
    if (bucketPrefix) queryParams.push(["prefix", bucketPrefix]);
    if (options.delimiter) queryParams.push(["delimiter", options.delimiter]);
    if (options.continuationToken) queryParams.push(["continuation-token", options.continuationToken]);
    queryParams.push(["max-keys", String(options.maxKeys ?? 1000)]);

    const canonicalQueryString = queryParams
      .map(([k, v]) => `${encodeS3QueryParam(k)}=${encodeS3QueryParam(v)}`)
      .sort()
      .join("&");
    const canonicalUri = `/${encodeURIComponent(cfg.bucket)}`;

    const authorization = await signGetRequest({
      canonicalUri,
      canonicalQueryString,
      host,
      payloadHash: EMPTY_PAYLOAD_HASH,
      amzDate,
      region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    });

    const url = `${endpoint.origin}${canonicalUri}?${canonicalQueryString}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-amz-content-sha256": EMPTY_PAYLOAD_HASH,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return err({ reason: "S3_LIST_FAILED", message: extractS3ErrorMessage(text) || `S3 list failed: ${response.status}` });
    }

    const xml = await response.text();
    return parseListObjectsXml(xml, bucketPrefix);
  } catch (error) {
    return err({ reason: "S3_LIST_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
}

function parseListObjectsXml(
  xml: string,
  prefix: string,
): Result<S3ListObjectsResult, { reason: "S3_LIST_FAILED"; message: string }> {
  const getTag = (tag: string, xml: string): string | null => {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1] : null;
  };

  const parseObjects = (xmlChunk: string): Array<{ key: string; size: number; lastModified: string }> => {
    const contents = xmlChunk.split("<Contents>").slice(1);
    return contents.map((chunk) => {
      const endOfChunk = chunk.split("</Contents>")[0];
      return {
        key: getTag("Key", endOfChunk) ?? "",
        size: Number(getTag("Size", endOfChunk) ?? "0"),
        lastModified: getTag("LastModified", endOfChunk) ?? "",
      };
    });
  };

  const parseCommonPrefixes = (xmlChunk: string): string[] => {
    const chunks = xmlChunk.split("<CommonPrefixes>").slice(1);
    return chunks
      .map((chunk) => {
        const block = chunk.split("</CommonPrefixes>")[0];
        return getTag("Prefix", block) ?? "";
      })
      .filter(Boolean);
  };

  const isTruncated = getTag("IsTruncated", xml) === "true";
  const nextToken = getTag("NextContinuationToken", xml);
  const objects = parseObjects(xml);
  const prefixes = parseCommonPrefixes(xml);

  const normalizedPrefix = prefix.replace(/\/+$/, "");
  const strippedPrefix = normalizedPrefix ? `${normalizedPrefix}/` : "";
  const stripPrefix = (key: string) => key.startsWith(strippedPrefix) ? key.slice(strippedPrefix.length) : key;

  return ok({
    objects: objects.map((o) => ({ ...o, key: stripPrefix(o.key) })),
    prefixes: prefixes.map((p) => stripPrefix(p.replace(/\/$/, ""))),
    isTruncated,
    nextContinuationToken: nextToken ?? undefined,
  });
}

// ── S3 Delete Object ─────────────────────────────────────────

export async function deleteS3Object(
  cfg: S3Config,
  key: string,
): Promise<Result<{ success: boolean }, { reason: "S3_DELETE_FAILED"; message: string }>> {
  try {
    const endpoint = new URL(cfg.endpoint);
    const host = endpoint.host;
    const region = cfg.region?.trim() || "us-east-1";
    const amzDate = formatAmzDate(new Date());

    const fullKey = [cfg.pathPrefix?.trim(), key].filter(Boolean).join("/");
    const canonicalUri = `/${encodeURIComponent(cfg.bucket)}/${encodeObjectKey(fullKey)}`;

    const authorization = await signDeleteRequest({
      canonicalUri,
      host,
      payloadHash: EMPTY_PAYLOAD_HASH,
      amzDate,
      region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    });

    const response = await fetch(`${endpoint.origin}${canonicalUri}`, {
      method: "DELETE",
      headers: {
        "x-amz-content-sha256": EMPTY_PAYLOAD_HASH,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
    });

    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      return err({ reason: "S3_DELETE_FAILED", message: extractS3ErrorMessage(text) || `S3 delete failed: ${response.status}` });
    }

    return ok({ success: true });
  } catch (error) {
    return err({ reason: "S3_DELETE_FAILED", message: error instanceof Error ? error.message : String(error) });
  }
}

// ── S3 Batch Delete ──────────────────────────────────────────

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

// ── S3 Upload for Media Library ───────────────────────────────

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
