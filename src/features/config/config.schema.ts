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

export const SystemConfigSchema = z.object({
  email: z
    .object({
      apiKey: z.string().optional(),
      host: z.string().optional(),
      port: z.number().int().positive().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      senderName: z.string().optional(),
      senderAddress: z.union([z.email(), z.literal("")]).optional(),
    })
    .optional(),
  notification: z
    .object({
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
    })
    .optional(),
  ai: z
    .object({
      provider: z
        .enum(["workers-ai", "openai-compatible", "agnes-ai"])
        .optional(),
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
    })
    .optional(),
  imageHosting: z
    .object({
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
    })
    .optional(),
  turnstile: z
    .object({
      enabled: z.boolean().optional(),
      siteKey: z.string().optional(),
      secretKey: z.string().optional(),
    })
    .optional(),
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
    turnstile: SystemConfigSchema.shape.turnstile,
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
  turnstile: {
    enabled: false,
    siteKey: "",
    secretKey: "",
  },
  site: blogConfig satisfies SiteConfigInput,
};

export const CONFIG_CACHE_KEYS = {
  system: ["system"] as const,
} as const;
