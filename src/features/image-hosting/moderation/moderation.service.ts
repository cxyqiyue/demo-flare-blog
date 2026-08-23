/**
 * 图片审查服务（参考 CloudFlare-ImgBed 的审查渠道设计）。
 *
 * 三个可选渠道（设置中单选）：
 * - workers-ai：Cloudflare Workers AI 内置视觉模型。免费额度为每天
 *   10,000 Neurons（无需绑卡，超出当日仅报错不扣费），博客量级足够。
 * - moderatecontent.com：官方 API Key 渠道。
 * - nsfwjs：自托管审查服务地址（nsfwjs 是 TensorFlow.js 模型，无法直接
 *   跑在 Workers 里，与 ImgBed 一致通过自托管 HTTP 服务调用）。
 *
 * 失败语义：
 * - 审查服务自身异常（网络错误、额度耗尽等）→ 放行并记录日志（fail-open），
 *   避免配额耗尽导致全站无法上传。
 * - 明确判定为成人内容 → 拒绝该次上传，并尽力删除已写入远端的对象。
 */

import type { SystemConfig } from "@/features/config/config.schema";
import type { ImageModerationChannel } from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import type {
  DiscordChannel,
  HuggingFaceChannel,
  TelegramChannel,
  WebDAVChannel,
} from "@/features/image-hosting/image-hosting.schema";
import * as DiscordChannelApi from "@/features/image-hosting/channels/discord";
import * as HuggingFaceChannelApi from "@/features/image-hosting/channels/huggingface";
import * as TelegramChannelApi from "@/features/image-hosting/channels/telegram";
import * as WebDavChannelApi from "@/features/image-hosting/channels/webdav";
import {
  deleteS3Objects,
  resolveValidatedS3Config,
} from "@/features/image-hosting/s3/s3-upload";
import * as MediaStorage from "@/features/media/data/media.storage";
import { err, ok, type Result } from "@/lib/errors";
import { m } from "@/paraglide/messages";

/** nsfwjs 分类中被封禁的类别与置信度阈值 */
const NSFW_BLOCK_CLASSES = new Set(["Porn", "Hentai"]);
const NSFW_BLOCK_PROBABILITY = 0.6;

const WORKERS_AI_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

export interface ModerationSettings {
  channel: ImageModerationChannel;
  moderateContentApiKey: string;
  nsfwApiUrl: string;
}

export interface ModerationInput {
  /** 上传后的可访问 URL；相对路径（R2）时需要 origin 才能交给外部服务 */
  url: string;
  /** 原始文件（workers-ai 直接读字节，无需公网可达） */
  file: File;
  /** 站点来源（用于把相对路径拼成绝对 URL）；缺省且外部渠道无法构造绝对地址时放行 */
  origin?: string;
  /** 上传目标渠道标识，用于拦截后清理 */
  providerLabel: string;
  /** 上传目标的持久化键，用于拦截后清理 */
  key: string;
}

function resolveSettings(  config: SystemConfig | undefined,
): ModerationSettings | null {
  const mod = config?.imageHosting?.moderation;
  if (!mod) return null;
  const channel = mod.channel ?? "off";
  if (channel === "off") return null;
  return {
    channel,
    moderateContentApiKey: mod.moderateContentApiKey?.trim() ?? "",
    nsfwApiUrl: mod.nsfwApiUrl?.trim() ?? "",
  };
}

function toAbsoluteUrl(url: string, origin?: string): string | null {
  if (!url.startsWith("/")) return url;
  if (!origin) return null;
  return `${origin.replace(/\/+$/, "")}${url}`;
}

// ── Workers AI ─────────────────────────────────────────────────

async function moderateWithWorkersAi(
  env: Env,
  file: File,
): Promise<boolean> {
  const bytes = await file.arrayBuffer();
  const result = (await env.AI.run(WORKERS_AI_MODEL, {
    image: bytes,
    prompt:
      'Does this image contain adult/pornographic/NSFW content? Answer strictly "yes" or "no".',
    max_tokens: 8,
  })) as { description?: unknown };
  const description =
    typeof result?.description === "string" ? result.description : "";
  return /^\s*yes/i.test(description);
}

// ── moderatecontent.com ────────────────────────────────────────

async function moderateWithModerateContent(
  apiKey: string,
  imageUrl: string,
): Promise<boolean> {
  const endpoint = `https://api.moderatecontent.com/moderate/?key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(imageUrl)}`;
  const response = await fetch(endpoint);
  const parsed = (await response.json().catch(() => null)) as {
    rating_label?: unknown;
  } | null;
  if (!parsed) throw new Error("moderatecontent: invalid response");
  return parsed.rating_label === "adult";
}

// ── nsfwjs 自托管服务 ──────────────────────────────────────────

async function moderateWithNsfwJs(
  baseUrl: string,
  imageUrl: string,
): Promise<boolean> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}?url=${encodeURIComponent(imageUrl)}`;
  const response = await fetch(endpoint);
  const parsed = (await response.json().catch(() => null)) as
    | Array<{ className?: unknown; probability?: unknown }>
    | Record<string, number>
    | null;

  let predictions: Array<{ className: string; probability: number }> = [];
  if (Array.isArray(parsed)) {
    predictions = parsed
      .filter(
        (p) => typeof p?.className === "string" && typeof p?.probability === "number",
      )
      .map((p) => ({ className: p.className as string, probability: p.probability as number }));
  } else if (parsed && typeof parsed === "object") {
    predictions = Object.entries(parsed)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => ({ className: k, probability: v as number }));
  }
  if (predictions.length === 0) throw new Error("nsfwjs: invalid response");

  return predictions.some(
    (p) =>
      NSFW_BLOCK_CLASSES.has(p.className) && p.probability >= NSFW_BLOCK_PROBABILITY,
  );
}

// ── 拦截后的远端清理 ───────────────────────────────────────────

async function deleteUploadedMediaBestEffort(
  config: SystemConfig | undefined,
  env: Env,
  providerLabel: string,
  key: string,
): Promise<void> {
  const ih = config?.imageHosting;
  try {
    switch (providerLabel) {
      case "r2-native":
      case "r2":
        await MediaStorage.deleteFromR2(env, key);
        break;
      case "telegram": {
        const { messageId } = TelegramChannelApi.parseTelegramKey(key);
        if (/^\d+$/.test(messageId) && ih?.telegram?.botToken) {
          await TelegramChannelApi.deleteTelegramMessage(
            ih.telegram as TelegramChannel,
            messageId,
          );
        }
        break;
      }
      case "discord":
        if (ih?.discord?.botToken) {
          await DiscordChannelApi.deleteDiscordMessage(
            ih.discord as DiscordChannel,
            key,
          );
        }
        break;
      case "s3": {
        const cfg = resolveValidatedS3Config(ih?.s3);
        if (cfg) {
          await deleteS3Objects(cfg, [key]);
        }
        break;
      }
      case "huggingface":
        if (ih?.huggingface?.token && ih?.huggingface?.repo) {
          await HuggingFaceChannelApi.deleteHuggingFaceFiles(
            ih.huggingface as HuggingFaceChannel,
            [key],
          );
        }
        break;
      case "webdav":
        if (ih?.webdav?.baseUrl) {
          await WebDavChannelApi.deleteWebDavPaths(
            ih.webdav as WebDAVChannel,
            [key],
          );
        }
        break;
      default:
        // api-key 图床（imgbb/ffsky）无远程删除能力；URL 已被拒绝，不影响安全。
        break;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "moderation cleanup failed",
        providerLabel,
        key,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/**
 * 上传完成后执行审查。
 * 返回 null 表示放行（未启用、判定正常或审查服务异常 fail-open）；
 * 返回 error 表示判定为违规内容，已尽力清理远端对象。
 */
export async function enforceImageModeration(
  context: DbContext & { executionCtx: ExecutionContext },
  args: ModerationInput,
): Promise<Result<{ allowed: true }, { reason: string; message: string }>> {
  const config = await ConfigService.getSystemConfig(context);
  const settings = resolveSettings(config);
  if (!settings) return ok({ allowed: true });

  try {
    let blocked = false;

    if (settings.channel === "workers-ai") {
      blocked = await moderateWithWorkersAi(context.env, args.file);
    } else if (settings.channel === "moderatecontent") {
      if (!settings.moderateContentApiKey) return ok({ allowed: true });
      const absolute = toAbsoluteUrl(args.url, args.origin);
      if (!absolute) {
        console.warn(
          JSON.stringify({
            message: "moderation skipped: no public url available",
          }),
        );
        return ok({ allowed: true });
      }
      blocked = await moderateWithModerateContent(
        settings.moderateContentApiKey,
        absolute,
      );
    } else {
      if (!settings.nsfwApiUrl) return ok({ allowed: true });
      const absolute = toAbsoluteUrl(args.url, args.origin);
      if (!absolute) {
        console.warn(
          JSON.stringify({
            message: "moderation skipped: no public url available",
          }),
        );
        return ok({ allowed: true });
      }
      blocked = await moderateWithNsfwJs(settings.nsfwApiUrl, absolute);
    }

    if (!blocked) return ok({ allowed: true });

    await deleteUploadedMediaBestEffort(config, context.env, args.providerLabel, args.key);
    return err({
      reason: "CONTENT_MODERATION_BLOCKED",
      message: m.moderation_upload_blocked(),
    });
  } catch (error) {
    // 审查服务异常：放行并记录，避免额度耗尽/网络故障阻塞正常上传。
    console.error(
      JSON.stringify({
        message: "image moderation failed (fail-open)",
        channel: settings.channel,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return ok({ allowed: true });
  }
}
