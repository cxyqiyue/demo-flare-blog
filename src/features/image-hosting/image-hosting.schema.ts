import { z } from "zod";

// ── 图床供应商类别（单选互斥） ─────────────────────────────
export const IMAGE_HOSTING_ACTIVE_PROVIDER = [
  "r2-native",
  "s3",
  "api-key",
  "telegram",
  "discord",
  "huggingface",
  "webdav",
] as const;
export type ActiveImageHostingProvider = (typeof IMAGE_HOSTING_ACTIVE_PROVIDER)[number];

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
  pathStyle: z.boolean().optional(),
});
export type S3ConnectionConfig = z.infer<typeof S3ConnectionConfigSchema>;

// ── 图床供应商类别（用于旧逻辑兼容） ───────────────────────
export type ImageHostingProviderCategory =
  | "r2-native"
  | "s3"
  | "api-key"
  | "telegram"
  | "discord"
  | "huggingface"
  | "webdav";

// ── 上传大小上限字段（各渠道通用，单位 MB） ────────────────────
export const MAX_FILE_SIZE_MB_FIELD = z.number().positive().max(4096);

// ── 图片处理全局设置 ─────────────────────────────────────────
// 编辑器场景（文章/动态/评论/关于页）专用：达到阈值触发压缩并压向
// 自定义目标大小；媒体库上传保持渠道原始限制，两者互不影响。
export const IMAGE_CONVERT_FORMATS = ["none", "webp", "jpeg"] as const;
export type ImageConvertFormat = (typeof IMAGE_CONVERT_FORMATS)[number];

export const ImageProcessingSettingsSchema = z.object({
  compressEnabled: z.boolean().optional(),
  convertToFormat: z.enum(IMAGE_CONVERT_FORMATS).optional(),
  /** 触发压缩的大小阈值（MB）；不设置时按渠道上限触发 */
  compressThresholdMb: z.number().positive().max(4096).optional(),
  /** 压缩目标大小（MB，支持小数）；不设置时压缩到触发阈值内 */
  compressTargetMb: z.number().positive().max(4096).optional(),
});
export type ImageProcessingSettings = z.infer<typeof ImageProcessingSettingsSchema>;

// ── API Key 图床实例 ─────────────────────────────────────────
export const ApiKeyProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(API_KEY_PROVIDER_TYPES),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().optional(),
  articleEnabled: z.boolean().optional(),
  commentEnabled: z.boolean().optional(),
  maxFileSizeMb: MAX_FILE_SIZE_MB_FIELD.optional(),
});
export type ApiKeyProvider = z.infer<typeof ApiKeyProviderSchema>;

// ── Telegram 渠道配置 ───────────────────────────────────────
export const TelegramChannelSchema = z.object({
  botToken: z.string().optional(),
  chatId: z.string().optional(),
  proxyUrl: z.string().optional(),
  maxFileSizeMb: MAX_FILE_SIZE_MB_FIELD.optional(),
});
export type TelegramChannel = z.infer<typeof TelegramChannelSchema>;

// ── Discord 渠道配置 ────────────────────────────────────────
export const DiscordChannelSchema = z.object({
  botToken: z.string().optional(),
  channelId: z.string().optional(),
  proxyUrl: z.string().optional(),
  isNitro: z.boolean().optional(),
  maxFileSizeMb: MAX_FILE_SIZE_MB_FIELD.optional(),
});
export type DiscordChannel = z.infer<typeof DiscordChannelSchema>;

// ── HuggingFace 渠道配置 ────────────────────────────────────
export const HuggingFaceChannelSchema = z.object({
  token: z.string().optional(),
  repo: z.string().optional(),
  isPrivate: z.boolean().optional(),
  maxFileSizeMb: MAX_FILE_SIZE_MB_FIELD.optional(),
});
export type HuggingFaceChannel = z.infer<typeof HuggingFaceChannelSchema>;

// ── WebDAV 渠道配置 ─────────────────────────────────────────
export const WebDAVChannelSchema = z.object({
  baseUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  publicUrl: z.string().optional(),
  createDirectory: z.boolean().optional(),
  maxFileSizeMb: MAX_FILE_SIZE_MB_FIELD.optional(),
});
export type WebDAVChannel = z.infer<typeof WebDAVChannelSchema>;

// ── 上传输入 ─────────────────────────────────────────────────
export const UploadImageHostingInputSchema = z.instanceof(FormData);
export type UploadImageHostingInput = FormData;

// ── 测试连接输入 ─────────────────────────────────────────────
export const TestImageHostingConnectionInputSchema = z.object({
  category: z.enum(["s3", "api-key", "telegram", "discord", "huggingface", "webdav"]),
  s3: S3ConnectionConfigSchema.optional(),
  apiKeyProviderType: z.enum(API_KEY_PROVIDER_TYPES).optional(),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().optional(),
  telegram: TelegramChannelSchema.optional(),
  discord: DiscordChannelSchema.optional(),
  huggingface: HuggingFaceChannelSchema.optional(),
  webdav: WebDAVChannelSchema.optional(),
});
export type TestImageHostingConnectionInput = z.infer<
  typeof TestImageHostingConnectionInputSchema
>;

// ── 评论图床配置返回 ─────────────────────────────────────────
export interface CommentImageHostingConfig {
  enabled: boolean;
  providerCategory: ImageHostingProviderCategory | null;
  providerType?: ApiKeyProviderType;
  /** 当前渠道允许的最大上传字节数；null = 无固定上限 */
  maxImageBytes: number | null;
  /** 触发压缩的阈值（字节）；null = 按渠道上限触发 */
  compressThresholdBytes: number | null;
  /** 压缩目标大小（字节）；null = 压到触发阈值内 */
  compressTargetBytes: number | null;
  compressEnabled: boolean;
  convertToFormat: ImageConvertFormat;
}

// ── 文章图床配置返回 ─────────────────────────────────────────
export interface ArticleImageHostingConfig {
  enabled: boolean;
  /** 当前渠道允许的最大上传字节数；null = 无固定上限 */
  maxImageBytes: number | null;
  /** 触发压缩的阈值（字节）；null = 按渠道上限触发 */
  compressThresholdBytes: number | null;
  /** 压缩目标大小（字节）；null = 压到触发阈值内 */
  compressTargetBytes: number | null;
  compressEnabled: boolean;
  convertToFormat: ImageConvertFormat;
}

// ── 上传结果 provider 标识 ───────────────────────────────────
export type ImageHostingProviderLabel =
  | "r2-native"
  | "s3"
  | "imgbb"
  | "ffsky"
  | "telegram"
  | "discord"
  | "huggingface"
  | "webdav";
