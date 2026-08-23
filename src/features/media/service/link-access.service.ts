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
import { fetchS3ImageStream } from "@/features/image-hosting/s3/s3-upload";
import { err, ok, type Result } from "@/lib/errors";

export interface LinkAccessSettings {
  mode: "direct" | "protected";
  refererAllowlist: string[];
  allowEmptyReferer: boolean;
  /**
   * 站点自身域名（归一化 hostname）：博客自己页面的引用无条件放行，
   * 不受白名单填写格式影响。包含请求 Host 与 DOMAIN / CDN_DOMAIN。
   */
  ownDomains: string[];
}

/**
 * 归一化域名条目：小写；剥离协议、路径/查询、端口与前导 www.；
 * 保留 `*.` 通配前缀。这样无论管理员填 `https://www.x.com/blog/` 还是
 * 裸域名，都能正确匹配对应主机（含其子域名）。
 */
function normalizeDomainEntry(raw: string): string {
  const withoutWildcard = raw.trim().toLowerCase().startsWith("*.")
    ? `*.${raw.trim().toLowerCase().slice(2)}`
    : raw.trim().toLowerCase();
  return withoutWildcard
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/)[0]
    .split(":")[0]
    .replace(/^www\./, "")
    .trim();
}

export function getLinkAccessSettings(
  config: SystemConfig | undefined,
  ownDomains: string[] = [],
): LinkAccessSettings {
  const linkAccess = config?.imageHosting?.linkAccess;
  return {
    mode: linkAccess?.mode === "protected" ? "protected" : "direct",
    refererAllowlist: (linkAccess?.refererAllowlist ?? [])
      .map(normalizeDomainEntry)
      .filter(Boolean),
    allowEmptyReferer: linkAccess?.allowEmptyReferer ?? true,
    ownDomains: ownDomains.map(normalizeDomainEntry).filter(Boolean),
  };
}

function hostMatchesEntry(host: string, entry: string): boolean {
  const normalized = entry.replace(/^\*\./, "");
  return host === normalized || host.endsWith(`.${normalized}`);
}

/**
 * 判断请求是否被防盗链策略放行：
 * - 同站引用（Referer 主机与请求主机一致，或命中站点自身域名集合）
 *   始终放行——博客自己的页面永远能加载自己的图；
 * - 空 Referer 按 allowEmptyReferer 设置（默认放行，兼容直接打开/下载）；
 * - 其余外站需命中白名单域名（含子域名，www 与裸域名等价）。
 */
export function isRefererAllowed(
  request: Request,
  settings: LinkAccessSettings,
): boolean {
  const referer = request.headers.get("referer")?.trim();
  if (!referer) return settings.allowEmptyReferer;

  let refererHost: string;
  try {
    // hostname 不含端口，避免同站经不同端口访问时被误判为外站
    refererHost = new URL(referer).hostname.toLowerCase();
  } catch {
    return false;
  }

  let selfHost: string;
  try {
    selfHost = new URL(request.url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (refererHost === selfHost) return true;

  if (settings.ownDomains.some((entry) => hostMatchesEntry(refererHost, entry))) {
    return true;
  }

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

async function resolveS3Upstream(
  config: SystemConfig | undefined,
  key: string,
): Promise<Result<Response, ProxyResolveError>> {
  const cfg = resolveS3ConfigForProxy(config);
  if (!cfg) return err(proxyError("PROVIDER_NOT_CONFIGURED", "S3 not configured"));
  // 必须走 SigV4 签名回源：公开读 URL 对私有桶/虚拟主机型端点不可用（502 根因）
  const result = await fetchS3ImageStream(cfg, key);
  if (result.error) {
    return err(proxyError(result.error.reason, result.error.message));
  }
  return ok(result.data);
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
