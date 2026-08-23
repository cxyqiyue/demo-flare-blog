import { blogConfig } from "@/blog.config";
import * as CacheService from "@/features/cache/cache.service";
import type {
  AiProviderInstance,
  ChallengeProvider,
  SiteConfig,
  SystemConfig,
  UpdateSystemConfigSectionInput,
} from "@/features/config/config.schema";
import type { ApiKeyProvider } from "@/features/image-hosting/image-hosting.schema";
import {
  CONFIG_CACHE_KEYS,
  DEFAULT_CONFIG,
  SystemConfigSchema,
} from "@/features/config/config.schema";
import * as ConfigRepo from "@/features/config/data/config.data";
import { FullSiteConfigSchema } from "@/features/config/site-config.schema";
import type { SocialLink } from "@/features/config/utils/social-platforms";
import * as Storage from "@/features/media/data/media.storage";
import { purgeSiteCDNCache } from "@/lib/invalidate";

const DEFAULT_SMTP_PORT = 465;
const RESEND_SMTP_HOST = "smtp.resend.com";
const RESEND_SMTP_USERNAME = "resend";

/**
 * 解析人机验证 provider。
 * provider 字段优先；兼容旧的 pow/turnstile.enabled 开关（仅当 provider 缺失时生效）。
 */
export function resolveChallengeProvider(
  config: SystemConfig | null | undefined,
): ChallengeProvider {
  const challenge = config?.challenge;
  if (challenge?.provider) return challenge.provider;
  if (challenge?.turnstile?.enabled) return "turnstile";
  if (challenge?.pow?.enabled || challenge?.altcha?.enabled) return "altcha";
  return "none";
}

export function resolveChallengeConfig(
  config: SystemConfig | null | undefined,
) {
  const challenge = config?.challenge;
  const altchaEnabled =
    challenge?.altcha?.enabled ?? challenge?.pow?.enabled ?? false;
  return {
    provider: resolveChallengeProvider(config),
    altcha: {
      enabled: altchaEnabled,
      difficulty:
        challenge?.altcha?.difficulty ??
        DEFAULT_CONFIG.challenge?.altcha?.difficulty,
    },
    pow: {
      enabled: altchaEnabled,
      difficulty:
        challenge?.altcha?.difficulty ??
        challenge?.pow?.difficulty ??
        DEFAULT_CONFIG.challenge?.pow?.difficulty,
    },
    turnstile: {
      enabled: challenge?.turnstile?.enabled ?? false,
      siteKey: challenge?.turnstile?.siteKey ?? "",
      secretKey: challenge?.turnstile?.secretKey ?? "",
      fallback: {
        maxFailures:
          challenge?.turnstile?.fallback?.maxFailures ??
          DEFAULT_CONFIG.challenge?.turnstile?.fallback?.maxFailures,
        timeoutMs:
          challenge?.turnstile?.fallback?.timeoutMs ??
          DEFAULT_CONFIG.challenge?.turnstile?.fallback?.timeoutMs,
      },
    },
  };
}

function resolveEmailConfig(config: SystemConfig | null | undefined) {
  const email = config?.email;
  const legacyApiKey = email?.apiKey?.trim() || "";
  const password = email?.password?.trim() || legacyApiKey;
  const host = email?.host?.trim() || (legacyApiKey ? RESEND_SMTP_HOST : "");
  const username =
    email?.username?.trim() || (legacyApiKey ? RESEND_SMTP_USERNAME : "");

  return {
    host,
    port: email?.port ?? DEFAULT_SMTP_PORT,
    username,
    password,
    senderName: email?.senderName ?? "",
    senderAddress: email?.senderAddress ?? "",
  };
}

// ── AI 配置旧版迁移 ─────────────────────────────────────────
function migrateAiConfig(
  config: SystemConfig | null | undefined,
): SystemConfig["ai"] {
  const ai = config?.ai;
  if (!ai) return DEFAULT_CONFIG.ai;

  // 已是新版格式（有 providers 数组）→ 直接使用
  if (ai.providers) {
    return {
      workersAi: ai.workersAi ?? DEFAULT_CONFIG.ai?.workersAi,
      activeProviderId: ai.activeProviderId,
      providers: ai.providers,
      blogSkillType: ai.blogSkillType ?? DEFAULT_CONFIG.ai?.blogSkillType,
      writingInstructions: ai.writingInstructions ?? "",
    };
  }

  // ── 旧版迁移 ──
  const providers: AiProviderInstance[] = [];

  // 迁移 openai-compatible
  const openai = ai.openaiCompatible as
    | { baseUrl?: string; apiKey?: string; model?: string }
    | undefined;
  if (openai?.baseUrl || openai?.apiKey) {
    providers.push({
      id: "migrated-openai",
      name: "OpenAI Compatible",
      type: "openai-compatible",
      baseUrl: openai.baseUrl ?? "",
      apiKey: openai.apiKey ?? "",
      model: openai.model ?? "",
    });
  }

  // 迁移 agnes-ai（本质是 OpenAI 兼容）
  const agnes = ai.agnesAi as
    | { baseUrl?: string; apiKey?: string; model?: string }
    | undefined;
  if (agnes?.baseUrl || agnes?.apiKey) {
    providers.push({
      id: "migrated-agnes",
      name: "Agnes AI",
      type: "openai-compatible",
      baseUrl: agnes.baseUrl ?? "",
      apiKey: agnes.apiKey ?? "",
      model: agnes.model ?? "",
    });
  }

  // 确定活跃供应商
  let activeProviderId: string | undefined;
  const oldProvider = ai.provider as string | undefined;
  if (oldProvider === "openai-compatible" && openai?.baseUrl) {
    activeProviderId = "migrated-openai";
  } else if (oldProvider === "agnes-ai" && agnes?.baseUrl) {
    activeProviderId = "migrated-agnes";
  }
  // workers-ai → activeProviderId 保持 undefined

  const isWorkersAi =
    !oldProvider ||
    oldProvider === "workers-ai" ||
    (!activeProviderId && providers.length === 0);

  return {
    workersAi: { enabled: isWorkersAi },
    activeProviderId: isWorkersAi ? undefined : activeProviderId,
    providers,
    blogSkillType: ai.blogSkillType ?? "blog",
    writingInstructions: ai.writingInstructions ?? "",
  };
}

// ── 图床配置旧版迁移 ─────────────────────────────────────────
function migrateImageHostingConfig(
  config: SystemConfig | null | undefined,
): SystemConfig["imageHosting"] {
  const ih = config?.imageHosting;
  if (!ih) return DEFAULT_CONFIG.imageHosting;

  // 已是新版格式 → 直接使用
  if (ih.r2Native || ih.apiProviders) {
    return {
      activeProvider: ih.activeProvider ?? null,
      r2Native: ih.r2Native ?? DEFAULT_CONFIG.imageHosting?.r2Native,
      s3: { ...DEFAULT_CONFIG.imageHosting?.s3, ...ih.s3 },
      apiProviders: ih.apiProviders ?? [],
      telegram: ih.telegram ?? DEFAULT_CONFIG.imageHosting?.telegram,
      discord: ih.discord ?? DEFAULT_CONFIG.imageHosting?.discord,
      huggingface: ih.huggingface ?? DEFAULT_CONFIG.imageHosting?.huggingface,
      webdav: ih.webdav ?? DEFAULT_CONFIG.imageHosting?.webdav,
      imageProcessing:
        ih.imageProcessing ?? DEFAULT_CONFIG.imageHosting?.imageProcessing,
      moderation: ih.moderation ?? DEFAULT_CONFIG.imageHosting?.moderation,
      linkAccess: ih.linkAccess ?? DEFAULT_CONFIG.imageHosting?.linkAccess,
    };
  }

  // ── 旧版迁移 ──
  const apiProviders: ApiKeyProvider[] = [];

  // 迁移 imgbb
  const imgbb = ih.imgbb as
    | {
        apiKey?: string;
        articleEnabled?: boolean;
        commentEnabled?: boolean;
      }
    | undefined;
  if (imgbb?.apiKey) {
    apiProviders.push({
      id: "migrated-imgbb",
      name: "ImgBB",
      type: "imgbb",
      apiKey: imgbb.apiKey,
      articleEnabled: !!imgbb.articleEnabled,
      commentEnabled: !!imgbb.commentEnabled,
    });
  }

  // 迁移 ffsky
  const ffsky = ih.ffsky as
    | { apiKey?: string; apiEndpoint?: string; articleEnabled?: boolean }
    | undefined;
  if (ffsky?.apiKey) {
    apiProviders.push({
      id: "migrated-ffsky",
      name: "Ffsky",
      type: "ffsky",
      apiKey: ffsky.apiKey,
      apiEndpoint: ffsky.apiEndpoint,
      articleEnabled: !!ffsky.articleEnabled,
      commentEnabled: false,
    });
  }

  // 迁移 S3（保持不变，但移除 cloudflare-r2 preset 的特殊处理）
  const s3 = ih.s3;

  // 默认启用 R2 原生
  const hasExternalHosting = apiProviders.length > 0 || !!s3?.articleEnabled;

  return {
    activeProvider: ih.activeProvider ?? null,
    r2Native: {
      articleEnabled: !hasExternalHosting,
      commentEnabled:
        !s3?.commentEnabled && !apiProviders.some((p) => p.commentEnabled),
    },
    s3: s3
      ? {
          articleEnabled: !!s3.articleEnabled,
          commentEnabled: !!s3.commentEnabled,
          provider: s3.provider ?? "aws",
          endpoint: s3.endpoint ?? "",
          bucket: s3.bucket ?? "",
          region: s3.region ?? "",
          accessKeyId: s3.accessKeyId ?? "",
          secretAccessKey: s3.secretAccessKey ?? "",
          pathPrefix: s3.pathPrefix ?? "",
          publicUrl: s3.publicUrl ?? "",
          pathStyle: s3.pathStyle,
          maxFileSizeMb: s3.maxFileSizeMb,
        }
      : DEFAULT_CONFIG.imageHosting?.s3,
    apiProviders,
    telegram: ih.telegram ?? DEFAULT_CONFIG.imageHosting?.telegram,
    discord: ih.discord ?? DEFAULT_CONFIG.imageHosting?.discord,
    huggingface: ih.huggingface ?? DEFAULT_CONFIG.imageHosting?.huggingface,
    webdav: ih.webdav ?? DEFAULT_CONFIG.imageHosting?.webdav,
    imageProcessing:
      ih.imageProcessing ?? DEFAULT_CONFIG.imageHosting?.imageProcessing,
    moderation: ih.moderation ?? DEFAULT_CONFIG.imageHosting?.moderation,
    linkAccess: ih.linkAccess ?? DEFAULT_CONFIG.imageHosting?.linkAccess,
  };
}

export function resolveSystemConfig(
  config: SystemConfig | null | undefined,
): SystemConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    email: resolveEmailConfig(config),
    notification: {
      ...DEFAULT_CONFIG.notification,
      ...config?.notification,
      admin: {
        ...DEFAULT_CONFIG.notification?.admin,
        ...config?.notification?.admin,
        channels: {
          ...DEFAULT_CONFIG.notification?.admin?.channels,
          ...config?.notification?.admin?.channels,
        },
      },
      user: {
        ...DEFAULT_CONFIG.notification?.user,
        ...config?.notification?.user,
      },
      webhooks:
        config?.notification?.webhooks ?? DEFAULT_CONFIG.notification?.webhooks,
    },
    ai: migrateAiConfig(config),
    imageHosting: migrateImageHostingConfig(config),
    challenge: resolveChallengeConfig(config),
    usage: {
      ...DEFAULT_CONFIG.usage,
      ...config?.usage,
    },
    wechatVerify: {
      ...DEFAULT_CONFIG.wechatVerify,
      ...config?.wechatVerify,
    },
    cloudflareAnalytics: resolveCloudflareAnalyticsConfig(config),
    site: resolveSiteConfig(config),
  };
}

function migrateSocial(social: unknown): SocialLink[] {
  if (Array.isArray(social)) return social;

  if (social && typeof social === "object") {
    const old = social as { github?: string; email?: string };
    const migrated: SocialLink[] = [];
    if (old.github) migrated.push({ platform: "github", url: old.github });
    if (old.email)
      migrated.push({ platform: "email", url: `mailto:${old.email}` });
    return migrated;
  }

  return [...blogConfig.social];
}

export function resolveSiteConfig(
  config: SystemConfig | null | undefined,
): SiteConfig {
  const configDefaultBackground = config?.site?.theme?.default?.background;

  return FullSiteConfigSchema.parse({
    title: config?.site?.title ?? blogConfig.title,
    author: config?.site?.author ?? blogConfig.author,
    description: config?.site?.description ?? blogConfig.description,
    social: migrateSocial(config?.site?.social),
    icons: {
      faviconSvg:
        config?.site?.icons?.faviconSvg || blogConfig.icons.faviconSvg,
      faviconIco:
        config?.site?.icons?.faviconIco || blogConfig.icons.faviconIco,
      favicon96: config?.site?.icons?.favicon96 || blogConfig.icons.favicon96,
      appleTouchIcon:
        config?.site?.icons?.appleTouchIcon || blogConfig.icons.appleTouchIcon,
      webApp192: config?.site?.icons?.webApp192 || blogConfig.icons.webApp192,
      webApp512: config?.site?.icons?.webApp512 || blogConfig.icons.webApp512,
    },
    theme: {
      default: {
        navBarName:
          config?.site?.theme?.default?.navBarName ??
          blogConfig.theme.default.navBarName,
        background: configDefaultBackground
          ? {
              homeImage: configDefaultBackground.homeImage ?? "",
              globalImage: configDefaultBackground.globalImage ?? "",
              light: {
                opacity: configDefaultBackground.light?.opacity ?? 0.15,
              },
              dark: {
                opacity: configDefaultBackground.dark?.opacity ?? 0.1,
              },
              backdropBlur: configDefaultBackground.backdropBlur ?? 8,
              transitionDuration:
                configDefaultBackground.transitionDuration ?? 600,
            }
          : undefined,
      },
      fuwari: {
        homeBg:
          config?.site?.theme?.fuwari?.homeBg ?? blogConfig.theme.fuwari.homeBg,
        avatar:
          config?.site?.theme?.fuwari?.avatar ?? blogConfig.theme.fuwari.avatar,
        primaryHue:
          config?.site?.theme?.fuwari?.primaryHue ??
          blogConfig.theme.fuwari.primaryHue,
      },
    },
  });
}

function hasSiteConfigChanged(
  currentConfig: SystemConfig | null | undefined,
  nextConfig: SystemConfig | null | undefined,
) {
  return (
    JSON.stringify(resolveSiteConfig(currentConfig)) !==
    JSON.stringify(resolveSiteConfig(nextConfig))
  );
}

function hasLinkAccessModeChanged(
  currentConfig: SystemConfig | null | undefined,
  nextConfig: SystemConfig | null | undefined,
) {
  return (
    (currentConfig?.imageHosting?.linkAccess?.mode ?? "direct") !==
    (nextConfig?.imageHosting?.linkAccess?.mode ?? "direct")
  );
}

function resolveCloudflareAnalyticsConfig(
  config: SystemConfig | null | undefined,
) {
  const ca = config?.cloudflareAnalytics;
  return {
    enabled: ca?.enabled ?? false,
    apiToken: ca?.apiToken ?? "",
    alert: {
      enabled: ca?.alert?.enabled ?? false,
      emailEnabled: ca?.alert?.emailEnabled ?? true,
      webhookEnabled: ca?.alert?.webhookEnabled ?? true,
      thresholds: {
        workersRequestsPct: ca?.alert?.thresholds?.workersRequestsPct ?? 80,
        workersCpuPct: ca?.alert?.thresholds?.workersCpuPct ?? 80,
        d1RowsReadPct: ca?.alert?.thresholds?.d1RowsReadPct ?? 80,
        r2StoragePct: ca?.alert?.thresholds?.r2StoragePct ?? 80,
        kvReadPct: ca?.alert?.thresholds?.kvReadPct ?? 80,
        kvWritePct: ca?.alert?.thresholds?.kvWritePct ?? 80,
        queuesMessagesPct: ca?.alert?.thresholds?.queuesMessagesPct ?? 80,
        workflowsInvocationsPct:
          ca?.alert?.thresholds?.workflowsInvocationsPct ?? 80,
        workersAiPct: ca?.alert?.thresholds?.workersAiPct ?? 80,
        durableObjectsRequestsPct:
          ca?.alert?.thresholds?.durableObjectsRequestsPct ?? 80,
      },
    },
  };
}

export async function getSystemConfig(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const config = await CacheService.get(
    context,
    CONFIG_CACHE_KEYS.system,
    SystemConfigSchema,
    async () =>
      resolveSystemConfig(await ConfigRepo.getSystemConfig(context.db)),
  );

  const normalizedConfig = resolveSystemConfig(config);

  if (JSON.stringify(config) !== JSON.stringify(normalizedConfig)) {
    context.executionCtx.waitUntil(
      CacheService.set(
        context,
        CONFIG_CACHE_KEYS.system,
        JSON.stringify(normalizedConfig),
        { ttl: "1h" },
      ),
    );
  }

  return normalizedConfig;
}

export async function getSiteConfig(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const config = await getSystemConfig(context);
  return resolveSiteConfig(config);
}

export async function updateSystemConfig(
  context: DbContext & { executionCtx: ExecutionContext },
  data: SystemConfig,
) {
  const currentConfig = await ConfigRepo.getSystemConfig(context.db);
  const nextConfig = resolveSystemConfig(data);

  await ConfigRepo.upsertSystemConfig(context.db, nextConfig);
  await CacheService.deleteKey(context, CONFIG_CACHE_KEYS.system);

  if (hasSiteConfigChanged(currentConfig, nextConfig)) {
    await purgeSiteCDNCache(context.env);
  }

  if (hasLinkAccessModeChanged(currentConfig, nextConfig)) {
    // 切换防盗链模式后，边缘已缓存的公开图副本必须清掉，否则
    // protected 校验对旧缓存不生效
    await purgeSiteCDNCache(context.env);
  }

  return { success: true };
}

export async function updateSystemConfigSection(
  context: DbContext & { executionCtx: ExecutionContext },
  input: UpdateSystemConfigSectionInput,
) {
  const currentConfig = resolveSystemConfig(
    await ConfigRepo.getSystemConfig(context.db),
  );
  const nextConfig = resolveSystemConfig({
    ...currentConfig,
    [input.section]: input.data,
  });

  await ConfigRepo.upsertSystemConfig(context.db, nextConfig);
  await CacheService.deleteKey(context, CONFIG_CACHE_KEYS.system);

  if (
    input.section === "site" &&
    hasSiteConfigChanged(currentConfig, nextConfig)
  ) {
    await purgeSiteCDNCache(context.env);
  }

  if (
    input.section === "imageHosting" &&
    hasLinkAccessModeChanged(currentConfig, nextConfig)
  ) {
    // 切换防盗链模式后清边缘缓存，保证新校验立即生效
    await purgeSiteCDNCache(context.env);
  }

  return { success: true };
}

export async function uploadSiteAsset(
  context: { env: Env },
  input: { file: File; assetPath: string },
): Promise<{ url: string }> {
  const { url } = await Storage.putSiteAsset(
    context.env,
    input.file,
    input.assetPath,
  );

  const timestamp = Math.floor(Date.now() / 1000);
  const isFavicon = input.assetPath.startsWith("favicon/");
  const finalUrl = isFavicon
    ? `${url}?original=true&v=${timestamp}`
    : `${url}?v=${timestamp}`;

  return { url: finalUrl };
}
