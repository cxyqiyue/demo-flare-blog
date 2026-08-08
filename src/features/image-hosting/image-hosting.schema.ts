import { z } from "zod";

export const IMAGE_HOSTING_PROVIDERS = ["imgbb", "ffsky", "s3"] as const;
export type ImageHostingProvider = (typeof IMAGE_HOSTING_PROVIDERS)[number];

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
  "aliyun-oss": (region) => `https://${region || "oss-cn-hangzhou"}.aliyuncs.com`,
  "tencent-cos": (region) => `https://cos.${region || "ap-guangzhou"}.myqcloud.com`,
};

export const IMGBB_API_ENDPOINT = "https://api.imgbb.com/1/upload";
export const IMGBB_UPLOAD_PAGE = "https://imgbb.com/upload";
export const DEFAULT_FFSKY_API_ENDPOINT = "https://pic.ffsky.net/api/1/upload";

/**
 * 测试用的 1x1 PNG（有效签名 + 正确 CRC），用于验证图床 API key 连通性。
 */
export const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

export const UploadImageHostingInputSchema = z.instanceof(FormData);
export type UploadImageHostingInput = FormData;

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

export const TestImageHostingConnectionInputSchema = z.object({
  provider: z.enum(IMAGE_HOSTING_PROVIDERS),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().optional(),
  s3: S3ConnectionConfigSchema.optional(),
});
export type TestImageHostingConnectionInput = z.infer<
  typeof TestImageHostingConnectionInputSchema
>;

export interface CommentImageHostingConfig {
  enabled: boolean;
  provider: ImageHostingProvider | null;
}

export interface ArticleImageHostingConfig {
  enabled: boolean;
}
