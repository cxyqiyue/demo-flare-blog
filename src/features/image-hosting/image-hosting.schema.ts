import { z } from "zod";

// ── API Key 图床类型 ──────────────────────────────────────────
export const API_KEY_PROVIDER_TYPES = ["imgbb", "ffsky"] as const;
export type ApiKeyProviderType = (typeof API_KEY_PROVIDER_TYPES)[number];

// ── S3 兼容存储子供应商 ──────────────────────────────────────
export const S3_PROVIDERS = [
  "aws",
  "cloudflare-r2",
  "aliyun-oss",
  "tencent-cos",
  "custom",
] as const;
export type S3Provider = (typeof S3_PROVIDERS)[number];

export const S3_DEFAULT_REGIONS: Record<S3Provider, string> = {
  aws: "us-east-1",
  "cloudflare-r2": "",
  "aliyun-oss": "oss-cn-hangzhou",
  "tencent-cos": "ap-guangzhou",
  custom: "",
};

export const S3_PRESET_ENDPOINT_BUILDER: Partial<
  Record<S3Provider, (region: string) => string>
> = {
  aws: (region) => `https://s3.${region || "us-east-1"}.amazonaws.com`,
  "aliyun-oss": (region) =>
    `https://${region || "oss-cn-hangzhou"}.aliyuncs.com`,
  "tencent-cos": (region) =>
    `https://cos.${region || "ap-guangzhou"}.myqcloud.com`,
};

// ── API Key 图床默认端点 ─────────────────────────────────────
export const IMGBB_API_ENDPOINT = "https://api.imgbb.com/1/upload";
export const IMGBB_UPLOAD_PAGE = "https://imgbb.com/upload";
export const DEFAULT_FFSKY_API_ENDPOINT = "https://pic.ffsky.net/api/1/upload";

/**
 * 测试用的 1x1 PNG（有效签名 + 正确 CRC），用于验证图床 API key 连通性。
 */
export const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

// ── S3 连接配置（用于测试） ─────────────────────────────────
export const S3ConnectionConfigSchema = z.object({
  provider: z.enum(S3_PROVIDERS).optional(),
  endpoint: z.string().optional(),
  bucket: z.string().optional(),
  region: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  pathPrefix: z.string().optional(),
  publicUrl: z.string().optional(),
});
export type S3ConnectionConfig = z.infer<typeof S3ConnectionConfigSchema>;

// ── 图床供应商类别 ───────────────────────────────────────────
export type ImageHostingProviderCategory = "r2-native" | "s3" | "api-key";

// ── API Key 图床实例 ─────────────────────────────────────────
export const ApiKeyProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(API_KEY_PROVIDER_TYPES),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().optional(),
  articleEnabled: z.boolean().optional(),
  commentEnabled: z.boolean().optional(),
});
export type ApiKeyProvider = z.infer<typeof ApiKeyProviderSchema>;

// ── 上传输入 ─────────────────────────────────────────────────
export const UploadImageHostingInputSchema = z.instanceof(FormData);
export type UploadImageHostingInput = FormData;

// ── 测试连接输入 ─────────────────────────────────────────────
export const TestImageHostingConnectionInputSchema = z.object({
  category: z.enum(["s3", "api-key"]),
  s3: S3ConnectionConfigSchema.optional(),
  apiKeyProviderType: z.enum(API_KEY_PROVIDER_TYPES).optional(),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().optional(),
});
export type TestImageHostingConnectionInput = z.infer<
  typeof TestImageHostingConnectionInputSchema
>;

// ── 评论图床配置返回 ─────────────────────────────────────────
export interface CommentImageHostingConfig {
  enabled: boolean;
  providerCategory: ImageHostingProviderCategory | null;
  providerType?: ApiKeyProviderType;
}

// ── 文章图床配置返回 ─────────────────────────────────────────
export interface ArticleImageHostingConfig {
  enabled: boolean;
}

// ── 上传结果 provider 标识 ───────────────────────────────────
export type ImageHostingProviderLabel =
  | "r2-native"
  | "s3"
  | "imgbb"
  | "ffsky";
