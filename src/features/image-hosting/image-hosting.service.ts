import * as ConfigService from "@/features/config/service/config.service";
import type { SystemConfig } from "@/features/config/config.schema";
import type {
  ArticleImageHostingConfig,
  CommentImageHostingConfig,
  ImageHostingProvider,
  TestImageHostingConnectionInput,
} from "@/features/image-hosting/image-hosting.schema";
import {
  DEFAULT_FFSKY_API_ENDPOINT,
  IMGBB_API_ENDPOINT,
  TEST_IMAGE_BASE64,
} from "@/features/image-hosting/image-hosting.schema";
import { parseUploadMediaInput } from "@/features/media/media.schema";
import { getImageDimensions } from "@/features/media/utils/image-dimensions";
import { err, ok, type Result } from "@/lib/errors";
import { m } from "@/paraglide/messages";

const ARTICLE_PROVIDER_ORDER: Array<ImageHostingProvider> = ["imgbb", "ffsky"];

interface ProviderRuntimeConfig {
  enabled: boolean;
  apiKey: string;
  apiEndpoint: string;
  fieldName: "image" | "source";
}

function resolveProviderRuntimeConfig(
  config: SystemConfig | undefined,
  provider: ImageHostingProvider,
): ProviderRuntimeConfig {
  if (provider === "imgbb") {
    const providerConfig = config?.imageHosting?.imgbb;
    return {
      enabled: !!providerConfig?.articleEnabled,
      apiKey: providerConfig?.apiKey?.trim() ?? "",
      apiEndpoint: IMGBB_API_ENDPOINT,
      fieldName: "image",
    };
  }

  const providerConfig = config?.imageHosting?.ffsky;
  return {
    enabled: !!providerConfig?.articleEnabled,
    apiKey: providerConfig?.apiKey?.trim() ?? "",
    apiEndpoint:
      providerConfig?.apiEndpoint?.trim() || DEFAULT_FFSKY_API_ENDPOINT,
    fieldName: "source",
  };
}

function extractImageUrlFromResponse(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null;

  const body = parsed as Record<string, unknown>;
  const imgbbData = body.data;
  if (imgbbData && typeof imgbbData === "object") {
    const data = imgbbData as Record<string, unknown>;
    if (typeof data.display_url === "string" && data.display_url) {
      return data.display_url;
    }
    if (typeof data.url === "string" && data.url) {
      return data.url;
    }
  }

  const imageData = body.image;
  if (imageData && typeof imageData === "object") {
    const data = imageData as Record<string, unknown>;
    if (typeof data.url === "string" && data.url) {
      return data.url;
    }
    if (typeof data.display_url === "string" && data.display_url) {
      return data.display_url;
    }
  }

  return null;
}

function extractErrorMessage(parsed: unknown, responseText: string): string {
  if (typeof parsed === "object" && parsed !== null) {
    const body = parsed as Record<string, unknown>;
    const error = body.error;
    if (error && typeof error === "object") {
      const errorData = error as Record<string, unknown>;
      const message =
        typeof errorData.message === "string" && errorData.message
          ? errorData.message
          : typeof errorData.code === "string" && errorData.code
            ? errorData.code
            : undefined;
      if (message) return message;
    }
    if (typeof body.status_txt === "string" && body.status_txt) {
      return body.status_txt;
    }
  }
  if (responseText) return responseText.slice(0, 300);
  return "Request failed";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function uploadToEndpoint(
  endpoint: string,
  apiKey: string,
  base64: string,
  fieldName: "image" | "source",
): Promise<
  Result<{ url: string }, { reason: "PROVIDER_REQUEST_FAILED"; message: string }>
> {
  try {
    const form = new FormData();
    form.append("key", apiKey);
    form.append(fieldName, base64);

    const response = await fetch(endpoint, { method: "POST", body: form });
    const responseText = await response.text();

    let parsed: unknown = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    const url = extractImageUrlFromResponse(parsed);
    if (url) return ok({ url });

    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: extractErrorMessage(parsed, responseText),
    });
  } catch (error) {
    return err({
      reason: "PROVIDER_REQUEST_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export type ArticleUploadResult =
  | {
      mode: "image-hosting";
      provider: ImageHostingProvider;
      url: string;
      width?: number;
      height?: number;
    }
  | { mode: "none" };

export async function uploadForArticle(
  context: DbContext & { executionCtx: ExecutionContext },
  formData: FormData,
): Promise<
  Result<ArticleUploadResult, { reason: "IMAGE_HOSTING_UPLOAD_FAILED"; message: string }>
> {
  const { file } = parseUploadMediaInput(formData, m);

  const config = await ConfigService.getSystemConfig(context);

  // 第三方图床已启用时，R2 不作为回退目标：逐个尝试已启用且配了 key 的
  // 图床，仅当全部失败才返回错误；只有「未启用或未配置 key」才回退到 R2。
  let lastProviderError: { message: string } | null = null;
  for (const provider of ARTICLE_PROVIDER_ORDER) {
    const runtime = resolveProviderRuntimeConfig(config, provider);
    if (!runtime.enabled || !runtime.apiKey) continue;

    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const result = await uploadToEndpoint(
      runtime.apiEndpoint,
      runtime.apiKey,
      base64,
      runtime.fieldName,
    );

    if (result.error) {
      lastProviderError = result.error;
      continue;
    }

    const dimensions = getImageDimensions(await file.arrayBuffer());
    return ok({
      mode: "image-hosting",
      provider,
      url: result.data.url,
      width: dimensions?.width,
      height: dimensions?.height,
    });
  }

  if (lastProviderError) {
    return err({
      reason: "IMAGE_HOSTING_UPLOAD_FAILED",
      message: lastProviderError.message,
    });
  }

  return ok({ mode: "none" });
}

export async function testConnection(
  input: TestImageHostingConnectionInput,
): Promise<
  Result<{ success: true; url: string }, { reason: "IMAGE_HOSTING_TEST_FAILED"; message: string }>
> {
  const apiKey = input.apiKey?.trim() ?? "";
  if (!apiKey) {
    return err({
      reason: "IMAGE_HOSTING_TEST_FAILED",
      message: m.settings_image_hosting_test_missing_key(),
    });
  }

  const apiEndpoint =
    input.provider === "imgbb"
      ? IMGBB_API_ENDPOINT
      : input.apiEndpoint?.trim() || DEFAULT_FFSKY_API_ENDPOINT;
  const fieldName = input.provider === "imgbb" ? "image" : "source";

  const result = await uploadToEndpoint(
    apiEndpoint,
    apiKey,
    TEST_IMAGE_BASE64,
    fieldName,
  );
  if (result.error) {
    return err({
      reason: "IMAGE_HOSTING_TEST_FAILED",
      message: result.error.message,
    });
  }

  return ok({ success: true, url: result.data.url });
}

export async function getCommentImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<CommentImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);

  if (config?.imageHosting?.imgbb?.commentEnabled) {
    return { enabled: true, provider: "imgbb" };
  }

  return { enabled: false, provider: null };
}

export async function getArticleImageHostingConfig(
  context: DbContext & { executionCtx: ExecutionContext },
): Promise<ArticleImageHostingConfig> {
  const config = await ConfigService.getSystemConfig(context);

  const enabled =
    !!config?.imageHosting?.imgbb?.articleEnabled ||
    !!config?.imageHosting?.ffsky?.articleEnabled;

  return { enabled };
}
