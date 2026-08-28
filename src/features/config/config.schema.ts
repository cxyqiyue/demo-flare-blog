import { z } from "zod";
import { blogConfig } from "@/blog.config";
import {
  createSiteConfigInputFormSchema,
  type SiteConfigInput,
  SiteConfigInputSchema,
} from "@/features/config/site-config.schema";
import {
  ApiKeyProviderSchema,
  DiscordChannelSchema,
  HuggingFaceChannelSchema,
  ImageProcessingSettingsSchema,
  MAX_FILE_SIZE_MB_FIELD,
  TelegramChannelSchema,
  WebDAVChannelSchema,
} from "@/features/image-hosting/image-hosting.schema";
import {
  createWebhookEndpointFormSchema,
  webhookEndpointSchema,
} from "@/features/webhook/webhook.schema";
import type { Messages } from "@/lib/i18n";

export const AI_BLOG_SKILL_TYPES = ["blog", "docs", "newsletter"] as const;

export const EmailConfigSchema = z.object({
  apiKey: z.string().optional(),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  senderName: z.string().optional(),
  senderAddress: z.union([z.email(), z.literal("")]).optional(),
});

export const NotificationConfigSchema = z.object({
  admin: z
    .object({
      channels: z
        .object({
          email: z.boolean().optional(),
          webhook: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  user: z
    .object({
      emailEnabled: z.boolean().optional(),
    })
    .optional(),
  webhooks: z.array(webhookEndpointSchema).optional(),
});

export const SUBSCRIPTION_TEMPLATE_PLACEHOLDERS = [
  "{{articleTitle}}",
  "{{articleUrl}}",
  "{{siteName}}",
] as const;

export const SubscriptionConfigSchema = z.object({
  allUserNotifyEnabled: z.boolean().optional(),
  templateSubject: z.string().max(300).optional(),
  templateBody: z.string().max(50000).optional(),
});
export type SubscriptionConfig = z.infer<typeof SubscriptionConfigSchema>;
export type AiBlogSkillType = (typeof AI_BLOG_SKILL_TYPES)[number];

// ── AI 第三方兼容接口类型 ───────────────────────────────────
export const AI_COMPAT_TYPES = [
  "openai-compatible",
  "claude-compatible",
  "gemini-compatible",
] as const;
export type AiCompatType = (typeof AI_COMPAT_TYPES)[number];

// ── AI 第三方供应商实例 ─────────────────────────────────────
export const AiProviderInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(AI_COMPAT_TYPES),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});
export type AiProviderInstance = z.infer<typeof AiProviderInstanceSchema>;

// ── AI 配置 Schema ──────────────────────────────────────────
export const AiConfigSchema = z.object({
  workersAi: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  activeProviderId: z.string().optional(),
  providers: z.array(AiProviderInstanceSchema).optional(),
  blogSkillType: z.enum(AI_BLOG_SKILL_TYPES).optional(),
  writingInstructions: z.string().optional(),
  // ── 兼容旧版迁移字段（读取后自动转换，不再写入） ──
  provider: z.any().optional(),
  openaiCompatible: z.any().optional(),
  agnesAi: z.any().optional(),
});

// ── 图片审查配置（nsfwjs 无法直接跑在 Workers 中，与 ImgBed 一致
//    采用「自托管 nsfwjs API 地址」或 moderatecontent.com；Workers AI
//    使用免费额度（10,000 Neurons/天，超出当日仅报错不扣费）作为内置渠道 ──
export const IMAGE_MODERATION_CHANNELS = [
  "off",
  "workers-ai",
  "moderatecontent",
  "nsfwjs",
] as const;
export type ImageModerationChannel = (typeof IMAGE_MODERATION_CHANNELS)[number];

export const ImageModerationConfigSchema = z.object({
  channel: z.enum(IMAGE_MODERATION_CHANNELS).optional(),
  /** moderatecontent.com 的 API Key */
  moderateContentApiKey: z.string().optional(),
  /** 自托管 nsfwjs 兼容审查服务地址，按 GET {url}?url=<图片直链> 调用 */
  nsfwApiUrl: z.string().optional(),
});

// ── 图链访问控制（防盗链）：R2 原生在 /images/* 直接校验 Referer；
//    第三方渠道经 /media/file/:provider/:key 代理访问并同样校验。
//    Telegram/Discord 因直链含敏感令牌或会轮换失效，始终走代理。 ──
export const ImageLinkAccessConfigSchema = z.object({
  mode: z.enum(["direct", "protected"]).optional(),
  /** 允许外链的 Referer 域名列表；空列表 = 仅允许本站引用 */
  refererAllowlist: z.array(z.string()).optional(),
  /** 无 Referer 请求（直接打开/下载）是否放行，默认放行 */
  allowEmptyReferer: z.boolean().optional(),
});

// ── 图床配置 Schema ─────────────────────────────────────────
export const ImageHostingConfigSchema = z.object({
  // 单选互斥：当前激活的图床渠道（默认 R2 Native；null = 使用旧版优先级链兼容模式）
  activeProvider: z
    .enum([
      "r2-native",
      "s3",
      "api-key",
      "telegram",
      "discord",
      "huggingface",
      "webdav",
    ])
    .nullable()
    .optional(),
  r2Native: z
    .object({
      articleEnabled: z.boolean().optional(),
      commentEnabled: z.boolean().optional(),
      pathPrefix: z.string().optional(),
    })
    .optional(),
  s3: z
    .object({
      articleEnabled: z.boolean().optional(),
      commentEnabled: z.boolean().optional(),
      provider: z.string().optional(),
      endpoint: z.string().optional(),
      bucket: z.string().optional(),
      region: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      pathPrefix: z.string().optional(),
      publicUrl: z.string().optional(),
      pathStyle: z.boolean().optional(),
      maxFileSizeMb: MAX_FILE_SIZE_MB_FIELD.optional(),
    })
    .optional(),
  apiProviders: z.array(ApiKeyProviderSchema).optional(),
  telegram: TelegramChannelSchema.optional(),
  discord: DiscordChannelSchema.optional(),
  huggingface: HuggingFaceChannelSchema.optional(),
  webdav: WebDAVChannelSchema.optional(),
  imageProcessing: ImageProcessingSettingsSchema.optional(),
  // ── 上传管理：图片审查（参考 CloudFlare-ImgBed 审查渠道） ──
  moderation: ImageModerationConfigSchema.optional(),
  // ── 图链访问控制（防盗链） ──
  linkAccess: ImageLinkAccessConfigSchema.optional(),
  // ── 兼容旧版迁移字段（读取后自动转换，不再写入） ──
  imgbb: z.any().optional(),
  ffsky: z.any().optional(),
});

export const CHALLENGE_PROVIDERS = ["none", "altcha", "turnstile"] as const;
export const ChallengeProviderSchema = z.enum(CHALLENGE_PROVIDERS);
export type ChallengeProvider = z.infer<typeof ChallengeProviderSchema>;

export const TurnstileFallbackConfigSchema = z.object({
  maxFailures: z.number().int().min(1).max(20).optional(),
  timeoutMs: z.number().int().min(5000).max(120000).optional(),
});

export const TurnstileConfigSchema = z.object({
  enabled: z.boolean().optional(),
  siteKey: z.string().optional(),
  secretKey: z.string().optional(),
  fallback: TurnstileFallbackConfigSchema.optional(),
});

export const AltchaConfigSchema = z.object({
  enabled: z.boolean().optional(),
  difficulty: z.number().int().min(10000).max(1000000).optional(),
});

/** @deprecated 旧键名，保留兼容；优先使用 AltchaConfigSchema */
export const PowConfigSchema = AltchaConfigSchema;

export const CHALLENGE_SCOPES = ["auth-only", "full-site"] as const;
export const ChallengeScopeSchema = z.enum(CHALLENGE_SCOPES);
export type ChallengeScope = z.infer<typeof ChallengeScopeSchema>;

export const ChallengeConfigSchema = z.object({
  provider: ChallengeProviderSchema.optional(),
  /** 保护范围：auth-only = 仅登录/注册；full-site = 前台所有页面 + 登录/注册 */
  scope: ChallengeScopeSchema.optional(),
  pow: PowConfigSchema.optional(),
  altcha: AltchaConfigSchema.optional(),
  turnstile: TurnstileConfigSchema.optional(),
});

export const UsageConfigSchema = z.object({
  enabled: z.boolean().optional(),
  selfReported: z.boolean().optional(),
  graphql: z.boolean().optional(),
});

export const WechatVerifyConfigSchema = z.object({
  fileName: z.string().optional(),
  fileContent: z.string().optional(),
});

export const CloudflareAnalyticsAlertSchema = z.object({
  enabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  webhookEnabled: z.boolean().optional(),
  thresholds: z
    .object({
      workersRequestsPct: z.number().min(0).max(100).optional(),
      workersCpuPct: z.number().min(0).max(100).optional(),
      d1RowsReadPct: z.number().min(0).max(100).optional(),
      r2StoragePct: z.number().min(0).max(100).optional(),
      kvReadPct: z.number().min(0).max(100).optional(),
      kvWritePct: z.number().min(0).max(100).optional(),
      kvStoragePct: z.number().min(0).max(100).optional(),
      queuesMessagesPct: z.number().min(0).max(100).optional(),
      workflowsInvocationsPct: z.number().min(0).max(100).optional(),
      workersAiPct: z.number().min(0).max(100).optional(),
      durableObjectsRequestsPct: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export const CloudflareAnalyticsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  apiToken: z.string().optional(),
  alert: CloudflareAnalyticsAlertSchema.optional(),
});

export const CONFIG_SECTIONS = [
  "email",
  "notification",
  "subscription",
  "ai",
  "imageHosting",
  "challenge",
  "usage",
  "wechatVerify",
  "site",
  "cloudflareAnalytics",
] as const;
export type ConfigSection = (typeof CONFIG_SECTIONS)[number];

export const UpdateSystemConfigSectionInputSchema = z.discriminatedUnion(
  "section",
  [
    z.object({ section: z.literal("email"), data: EmailConfigSchema }),
    z.object({
      section: z.literal("notification"),
      data: NotificationConfigSchema,
    }),
    z.object({
      section: z.literal("subscription"),
      data: SubscriptionConfigSchema,
    }),
    z.object({ section: z.literal("ai"), data: AiConfigSchema }),
    z.object({
      section: z.literal("imageHosting"),
      data: ImageHostingConfigSchema,
    }),
    z.object({ section: z.literal("challenge"), data: ChallengeConfigSchema }),
    z.object({ section: z.literal("usage"), data: UsageConfigSchema }),
    z.object({
      section: z.literal("wechatVerify"),
      data: WechatVerifyConfigSchema,
    }),
    z.object({ section: z.literal("site"), data: SiteConfigInputSchema }),
    z.object({
      section: z.literal("cloudflareAnalytics"),
      data: CloudflareAnalyticsConfigSchema,
    }),
  ],
);
export type UpdateSystemConfigSectionInput = z.infer<
  typeof UpdateSystemConfigSectionInputSchema
>;

export const SystemConfigSchema = z.object({
  email: EmailConfigSchema.optional(),
  notification: NotificationConfigSchema.optional(),
  subscription: SubscriptionConfigSchema.optional(),
  ai: AiConfigSchema.optional(),
  imageHosting: ImageHostingConfigSchema.optional(),
  challenge: ChallengeConfigSchema.optional(),
  usage: UsageConfigSchema.optional(),
  wechatVerify: WechatVerifyConfigSchema.optional(),
  site: SiteConfigInputSchema.optional(),
  cloudflareAnalytics: CloudflareAnalyticsConfigSchema.optional(),
});

export const createSystemConfigFormSchema = (messages: Messages) =>
  z.object({
    email: SystemConfigSchema.shape.email,
    notification: z
      .object({
        admin: SystemConfigSchema.shape.notification.unwrap().shape.admin,
        user: SystemConfigSchema.shape.notification.unwrap().shape.user,
        webhooks: z.array(createWebhookEndpointFormSchema(messages)).optional(),
      })
      .optional(),
    subscription: SystemConfigSchema.shape.subscription,
    ai: SystemConfigSchema.shape.ai,
    imageHosting: SystemConfigSchema.shape.imageHosting,
    challenge: SystemConfigSchema.shape.challenge,
    usage: SystemConfigSchema.shape.usage,
    wechatVerify: SystemConfigSchema.shape.wechatVerify,
    site: createSiteConfigInputFormSchema(messages).optional(),
    cloudflareAnalytics: SystemConfigSchema.shape.cloudflareAnalytics,
  });

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type {
  SiteConfig,
  SiteConfigInput,
} from "@/features/config/site-config.schema";

// ── 默认配置 ─────────────────────────────────────────────────
export const DEFAULT_CONFIG: SystemConfig = {
  email: {
    host: "",
    port: 465,
    username: "",
    password: "",
    senderName: "",
    senderAddress: "",
  },
  notification: {
    admin: {
      channels: {
        email: true,
        webhook: true,
      },
    },
    user: {
      emailEnabled: true,
    },
    webhooks: [],
  },
  subscription: {
    allUserNotifyEnabled: false,
    templateSubject: "",
    templateBody: "",
  },
  ai: {
    workersAi: { enabled: true },
    activeProviderId: undefined,
    providers: [],
    blogSkillType: "blog",
    writingInstructions: "",
  },
  imageHosting: {
    activeProvider: "r2-native",
    r2Native: {
      articleEnabled: true,
      commentEnabled: true,
      pathPrefix: "images/blog",
    },
    s3: {
      articleEnabled: false,
      commentEnabled: false,
      provider: "aws",
      endpoint: "",
      bucket: "",
      region: "",
      accessKeyId: "",
      secretAccessKey: "",
      pathPrefix: "",
      publicUrl: "",
      pathStyle: false,
    },
    apiProviders: [],
    telegram: {
      botToken: "",
      chatId: "",
      proxyUrl: "",
    },
    discord: {
      botToken: "",
      channelId: "",
      proxyUrl: "",
      isNitro: false,
    },
    huggingface: {
      token: "",
      repo: "",
      isPrivate: false,
    },
    webdav: {
      baseUrl: "",
      username: "",
      password: "",
      publicUrl: "",
      createDirectory: true,
    },
  },
  challenge: {
    provider: "none",
    scope: "auth-only",
    pow: {
      enabled: false,
      difficulty: 50000,
    },
    altcha: {
      enabled: false,
      difficulty: 50000,
    },
    turnstile: {
      enabled: false,
      siteKey: "",
      secretKey: "",
      fallback: {
        maxFailures: 3,
        timeoutMs: 30000,
      },
    },
  },
  usage: {
    enabled: false,
    selfReported: false,
    graphql: false,
  },
  wechatVerify: {
    fileName: "",
    fileContent: "",
  },
  cloudflareAnalytics: {
    enabled: false,
    apiToken: "",
    alert: {
      enabled: false,
      emailEnabled: true,
      webhookEnabled: true,
      thresholds: {
        workersRequestsPct: 80,
        workersCpuPct: 80,
        d1RowsReadPct: 80,
        r2StoragePct: 80,
        kvReadPct: 80,
        kvWritePct: 80,
        kvStoragePct: 80,
        queuesMessagesPct: 80,
        workflowsInvocationsPct: 80,
        workersAiPct: 80,
        durableObjectsRequestsPct: 80,
      },
    },
  },
  site: blogConfig satisfies SiteConfigInput,
};

export const CONFIG_CACHE_KEYS = {
  system: ["system"] as const,
} as const;
