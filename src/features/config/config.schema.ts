import { z } from "zod";
import { blogConfig } from "@/blog.config";
import {
  createSiteConfigInputFormSchema,
  type SiteConfigInput,
  SiteConfigInputSchema,
} from "@/features/config/site-config.schema";
import { webhookEndpointSchema } from "@/features/webhook/webhook.schema";
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
    })
    .optional(),
  site: SiteConfigInputSchema.optional(),
});

export const createSystemConfigFormSchema = (messages: Messages) =>
  z.object({
    email: SystemConfigSchema.shape.email,
    notification: SystemConfigSchema.shape.notification,
    ai: SystemConfigSchema.shape.ai,
    imageHosting: SystemConfigSchema.shape.imageHosting,
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
  },
  site: blogConfig satisfies SiteConfigInput,
};

export const CONFIG_CACHE_KEYS = {
  system: ["system"] as const,
} as const;
