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

// ── 图床配置 Schema ─────────────────────────────────────────
export const ImageHostingConfigSchema = z.object({
  // 单选互斥：当前激活的图床渠道（null = 使用旧版优先级链兼容模式）
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
    })
    .optional(),
  apiProviders: z.array(ApiKeyProviderSchema).optional(),
  telegram: TelegramChannelSchema.optional(),
  discord: DiscordChannelSchema.optional(),
  huggingface: HuggingFaceChannelSchema.optional(),
  webdav: WebDAVChannelSchema.optional(),
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

export const ChallengeConfigSchema = z.object({
  provider: ChallengeProviderSchema.optional(),
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
  ai: {
    workersAi: { enabled: true },
    activeProviderId: undefined,
    providers: [],
    blogSkillType: "blog",
    writingInstructions: "",
  },
  imageHosting: {
    activeProvider: null,
    r2Native: {
      articleEnabled: true,
      commentEnabled: true,
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
