import { err, ok, type Result } from "@/lib/errors";

export interface S3UploadConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix: string;
  publicUrl: string;
}

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
  return key
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

interface SignRequestParams {
  method: string;
  canonicalUri: string;
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
  const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

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
      const responseText = (await response.text()).slice(0, 300);
      return err({
        reason: "PROVIDER_REQUEST_FAILED",
        message:
          responseText || `S3 upload failed with status ${response.status}`,
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
