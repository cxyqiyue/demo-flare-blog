import { z } from "zod";

export const IMAGE_HOSTING_PROVIDERS = ["imgbb", "ffsky"] as const;
export type ImageHostingProvider = (typeof IMAGE_HOSTING_PROVIDERS)[number];

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

export const TestImageHostingConnectionInputSchema = z.object({
  provider: z.enum(IMAGE_HOSTING_PROVIDERS),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().optional(),
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
