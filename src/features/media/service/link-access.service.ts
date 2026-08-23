/**
 * 图链访问控制（防盗链）服务。
 *
 * 访问模式（设置中配置）：
 * - direct（默认）：第三方渠道返回原始直链，R2 原生仍走 /images/*。
 * - protected：所有渠道统一经 Worker 校验 Referer 后提供内容——
 *   · r2-native → /images/:key 直接拦截；
 *   · 其他渠道 → /media/file/:provider/:key 代理路由。
 *
 * Telegram / Discord 始终走代理（与模式无关）：Telegram 直链内嵌 Bot
 * Token 不能暴露给访客；Discord 附件直链为 ~24h 轮换的签名地址，只有
 * 经代理按 messageId 现取现用才能保证长期可用（同 ImgBed 的做法）。
 */

import type { SystemConfig } from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import * as DiscordChannelApi from "@/features/image-hosting/channels/discord";
import * as HuggingFaceChannelApi from "@/features/image-hosting/channels/huggingface";
import * as TelegramChannelApi from "@/features/image-hosting/channels/telegram";
import * as WebDavChannelApi from "@/features/image-hosting/channels/webdav";
import type { S3Config } from "@/features/image-hosting/s3/s3-upload";
import { err, ok, type Result } from "@/lib/errors";

export interface LinkAccessSettings {
  mode: "direct" | "protected";
  refererAllowlist: string[];
  allowEmptyReferer: boolean;
}

export function getLinkAccessSettings(
  config: SystemConfig | undefined,
): LinkAccessSettings {
  const linkAccess = config?.imageHosting?.linkAccess;
  return {
    mode: linkAccess?.mode === "protected" ? "protected" : "direct",
    refererAllowlist: (linkAccess?.refererAllowlist ?? [])
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, ""))
      .filter(Boolean),
    allowEmptyReferer: linkAccess?.allowEmptyReferer ?? true,
  };
}

function hostMatchesEntry(host: string, entry: string): boolean {
  const normalized = entry.replace(/^\*\./, "");
  return host === normalized || host.endsWith(`.${normalized}`);
}

/**
 * 判断请求是否被防盗链策略放行：
 * - 同站引用（与请求 Host 一致）始终放行；
 * - 空 Referer 按 allowEmptyReferer 设置（默认放行，兼容直接打开/下载）；
 * - 其余外站需命中白名单域名（含子域名）。
 */
export function isRefererAllowed(
  request: Request,
  settings: LinkAccessSettings,
): boolean {
  const referer = request.headers.get("referer")?.trim();
  if (!referer) return settings.allowEmptyReferer;

  let refererHost: string;
  try {
    refererHost = new URL(referer).host.toLowerCase();
  } catch {
    return false;
  }

  let selfHost: string;
  try {
    selfHost = new URL(request.url).host.toLowerCase();
  } catch {
    return false;
  }
  if (refererHost === selfHost) return true;

  return settings.refererAllowlist.some((entry) =>
    hostMatchesEntry(refererHost, entry),
  );
}

export const MEDIA_PROXY_PREFIX = "/media/file";

/**
 * 按当前访问模式计算对外提供的图链地址。
 * D1 中始终保存原始直链；此函数决定编辑器插入与复制链接时使用的地址。
 */
export function buildMediaAccessUrl(
  settings: LinkAccessSettings,
  providerLabel: string,
  key: string,
  directUrl: string,
): string {
  switch (providerLabel) {
    case "r2-native":
    case "r2":
      return `/images/${key}`;
    case "telegram": {
      // 键形如 telegram/{messageId}:{fileId}；fileId 用于代理回源现取直链
      const rest = key.replace(/^telegram\//, "");
      return `${MEDIA_PROXY_PREFIX}/telegram/${encodeURIComponent(rest)}`;
    }
    case "discord":
      return `${MEDIA_PROXY_PREFIX}/discord/${encodeURIComponent(key)}`;
    default: {
      // 仅可回源的渠道支持代理；API-Key 图床（无存储凭据）始终直链
      const proxyable =
        providerLabel === "s3" ||
        providerLabel === "huggingface" ||
        providerLabel === "webdav";
      if (settings.mode === "protected" && proxyable) {
        return `${MEDIA_PROXY_PREFIX}/${encodeURIComponent(providerLabel)}/${key
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`;
      }
      return directUrl;
    }
  }
}

// ── 代理路由的上游解析 ─────────────────────────────────────────

type ProxyResolveError = { reason: string; message: string };

function proxyError(reason: string, message: string): ProxyResolveError {
  return { reason, message };
}

async function fetchUpstream(url: string, init?: RequestInit): Promise<Result<Response, ProxyResolveError>> {
  try {
    const upstream = await fetch(url, init);
    if (!upstream.ok || !upstream.body) {
      return err(proxyError("UPSTREAM_FETCH_FAILED", "Upstream fetch failed"));
    }
    return ok(upstream);
  } catch (error) {
    return err(
      proxyError(
        "UPSTREAM_FETCH_FAILED",
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
}

async function resolveTelegramUpstream(
  config: SystemConfig | undefined,
  rawKey: string,
): Promise<Result<Response, ProxyResolveError>> {
  const tg = config?.imageHosting?.telegram;
  if (!tg?.botToken?.trim() || !tg.chatId?.trim()) {
    return err(proxyError("PROVIDER_NOT_CONFIGURED", "Telegram channel not configured"));
  }

  // 键形如 {messageId}:{fileId}；旧版纯 messageId 键缺少持久 file_id，
  // Bot API 无法按消息 ID 反查文件，只能提示重新上传。
  const { fileId } = TelegramChannelApi.parseTelegramKey(rawKey);
  if (!fileId) {
    return err(
      proxyError("LEGACY_RECORD", "Legacy record without file_id — please re-upload"),
    );
  }

  const result = await TelegramChannelApi.getTelegramFileUrl(tg, fileId);
  if (result.error) {
    return err(proxyError(result.error.reason, result.error.message));
  }
  return fetchUpstream(result.data.url);
}

async function resolveDiscordUpstream(
  config: SystemConfig | undefined,
  key: string,
): Promise<Result<Response, ProxyResolveError>> {
  const dc = config?.imageHosting?.discord;
  if (!dc?.botToken?.trim() || !dc.channelId?.trim()) {
    return err(proxyError("PROVIDER_NOT_CONFIGURED", "Discord channel not configured"));
  }

  const [messageId, indexRaw] = key.split(":");
  if (!/^\d+$/.test(messageId)) {
    return err(proxyError("INVALID_KEY", "Invalid Discord message id"));
  }
  const index = Number.parseInt(indexRaw ?? "0", 10) || 0;

  const result = await DiscordChannelApi.getDiscordMessageAttachment(
    dc,
    messageId,
    index,
  );
  if (result.error) {
    return err(proxyError(result.error.reason, result.error.message));
  }
  return fetchUpstream(result.data.url);
}

function resolveS3ConfigForProxy(
  config: SystemConfig | undefined,
): S3Config | null {
  const s3 = config?.imageHosting?.s3;
  const endpoint = s3?.endpoint?.trim();
  const bucket = s3?.bucket?.trim();
  const accessKeyId = s3?.accessKeyId?.trim();
  const secretAccessKey = s3?.secretAccessKey?.trim();
  if (!s3 || !endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    region: s3.region?.trim() || "us-east-1",
    accessKeyId,
    secretAccessKey,
    pathPrefix: s3.pathPrefix?.trim() || "",
    publicUrl: s3.publicUrl?.trim() || "",
    pathStyle: s3.pathStyle ?? false,
  };
}

function buildS3PublicUrl(cfg: S3Config, key: string): string {
  const base = (
    cfg.publicUrl?.trim() ||
    `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}`
  ).replace(/\/+$/, "");
  const encoded = key
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${base}/${encoded}`;
}

async function resolveS3Upstream(
  config: SystemConfig | undefined,
  key: string,
): Promise<Result<Response, ProxyResolveError>> {
  const cfg = resolveS3ConfigForProxy(config);
  if (!cfg) return err(proxyError("PROVIDER_NOT_CONFIGURED", "S3 not configured"));
  return fetchUpstream(buildS3PublicUrl(cfg, key));
}

async function resolveHuggingFaceUpstream(
  config: SystemConfig | undefined,
  key: string,
): Promise<Result<Response, ProxyResolveError>> {
  const hf = config?.imageHosting?.huggingface;
  if (!hf?.repo?.trim()) {
    return err(proxyError("PROVIDER_NOT_CONFIGURED", "HuggingFace not configured"));
  }

  const headers: HeadersInit = hf.token?.trim()
    ? { Authorization: `Bearer ${hf.token.trim()}` }
    : {};
  return fetchUpstream(HuggingFaceChannelApi.buildHfResolveUrl(hf.repo.trim(), key), {
    headers,
  });
}

async function resolveWebDavUpstream(
  config: SystemConfig | undefined,
  key: string,
): Promise<Result<Response, ProxyResolveError>> {
  const dav = config?.imageHosting?.webdav;
  if (!dav?.baseUrl?.trim()) {
    return err(proxyError("PROVIDER_NOT_CONFIGURED", "WebDAV not configured"));
  }

  const headers: HeadersInit = {};
  if (dav.username?.trim() || dav.password) {
    const credentials = btoa(
      `${dav.username?.trim() ?? ""}:${dav.password ?? ""}`,
    );
    headers.Authorization = `Basic ${credentials}`;
  }
  return fetchUpstream(WebDavChannelApi.buildWebDavPublicUrl(dav, key), {
    headers,
  });
}

/**
 * 解析 /media/file/:provider/:key 的上游内容。
 * 返回上游 Response（body 为流），由调用方附加防盗链后的响应头。
 */
export async function resolveProxiedMedia(
  context: DbContext & { executionCtx: ExecutionContext },
  provider: string,
  key: string,
): Promise<Result<Response, ProxyResolveError>> {
  const config = await ConfigService.getSystemConfig(context);

  switch (provider) {
    case "telegram":
      return resolveTelegramUpstream(config, key);
    case "discord":
      return resolveDiscordUpstream(config, key);
    case "s3":
      return resolveS3Upstream(config, key);
    case "huggingface":
      return resolveHuggingFaceUpstream(config, key);
    case "webdav":
      return resolveWebDavUpstream(config, key);
    case "r2-native":
    case "r2":
      return err(proxyError("UNSUPPORTED_PROVIDER", "R2 objects are served via /images/"));
    default:
      return err(proxyError("UNSUPPORTED_PROVIDER", `Unsupported provider: ${provider}`));
  }
}
