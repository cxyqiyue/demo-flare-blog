import { z } from "zod";
import { blogConfig } from "@/blog.config";
import {
  createSiteConfigInputFormSchema,
  type SiteConfigInput,
  SiteConfigInputSchema,
} from "@/features/config/site-config.schema";
import { S3_PROVIDERS } from "@/features/image-hosting/image-hosting.schema";
import {
  createWebhookEndpointFormSchema,
  webhookEndpointSchema,
} from "@/features/webhook/webhook.schema";
import type { Messages } from "@/lib/i18n";

export const AI_BLOG_SKILL_TYPES = ["blog", "docs", "newsletter"] as const;
export type AiBlogSkillType = (typeof AI_BLOG_SKILL_TYPES)[number];

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

export const AiConfigSchema = z.object({
  provider: z.enum(["workers-ai", "openai-compatible", "agnes-ai"]).optional(),
  blogSkillType: z.enum(AI_BLOG_SKILL_TYPES).optional(),
  openaiCompatible: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
  agnesAi: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
  writingInstructions: z.string().optional(),
});

export const ImageHostingConfigSchema = z.object({
  imgbb: z
    .object({
      commentEnabled: z.boolean().optional(),
      articleEnabled: z.boolean().optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
  ffsky: z
    .object({
      articleEnabled: z.boolean().optional(),
      apiKey: z.string().optional(),
      apiEndpoint: z.string().optional(),
    })
    .optional(),
  s3: z
    .object({
      commentEnabled: z.boolean().optional(),
      articleEnabled: z.boolean().optional(),
      provider: z.enum(S3_PROVIDERS).optional(),
      endpoint: z.string().optional(),
      bucket: z.string().optional(),
      region: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      pathPrefix: z.string().optional(),
      publicUrl: z.string().optional(),
    })
    .optional(),
});

export const TurnstileConfigSchema = z.object({
  enabled: z.boolean().optional(),
  siteKey: z.string().optional(),
  secretKey: z.string().optional(),
});

export const PowConfigSchema = z.object({
  enabled: z.boolean().optional(),
  difficulty: z.number().int().min(10000).max(1000000).optional(),
});

export const ChallengeConfigSchema = z.object({
  pow: PowConfigSchema.optional(),
  turnstile: TurnstileConfigSchema.optional(),
});

export const CONFIG_SECTIONS = [
  "email",
  "notification",
  "ai",
  "imageHosting",
  "challenge",
  "site",
] as const;
export type ConfigSection = (typeof CONFIG_SECTIONS)[number];

export const UpdateSystemConfigSectionInputSchema = z.discriminatedUnion(
  "section",
  [
    z.object({ section: z.literal("email"), data: EmailConfigSchema }),
    z.object({ section: z.literal("notification"), data: NotificationConfigSchema }),
    z.object({ section: z.literal("ai"), data: AiConfigSchema }),
    z.object({
      section: z.literal("imageHosting"),
      data: ImageHostingConfigSchema,
    }),
    z.object({ section: z.literal("challenge"), data: ChallengeConfigSchema }),
    z.object({ section: z.literal("site"), data: SiteConfigInputSchema }),
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
  site: SiteConfigInputSchema.optional(),
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
    site: createSiteConfigInputFormSchema(messages).optional(),
  });

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type {
  SiteConfig,
  SiteConfigInput,
} from "@/features/config/site-config.schema";

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
    provider: "workers-ai",
    blogSkillType: "blog",
    openaiCompatible: {
      baseUrl: "",
      apiKey: "",
      model: "",
    },
    agnesAi: {
      baseUrl: "https://apihub.agnes-ai.com/v1",
      apiKey: "",
      model: "",
    },
    writingInstructions: "",
  },
  imageHosting: {
    imgbb: {
      commentEnabled: false,
      articleEnabled: false,
      apiKey: "",
    },
    ffsky: {
      articleEnabled: false,
      apiKey: "",
      apiEndpoint: "https://pic.ffsky.net/api/1/upload",
    },
    s3: {
      commentEnabled: false,
      articleEnabled: false,
      provider: "cloudflare-r2",
      endpoint: "",
      bucket: "",
      region: "",
      accessKeyId: "",
      secretAccessKey: "",
      pathPrefix: "",
      publicUrl: "",
    },
  },
  challenge: {
    pow: {
      enabled: false,
      difficulty: 10000,
    },
    turnstile: {
      enabled: false,
      siteKey: "",
      secretKey: "",
    },
  },
  site: blogConfig satisfies SiteConfigInput,
};

export const CONFIG_CACHE_KEYS = {
  system: ["system"] as const,
} as const;
