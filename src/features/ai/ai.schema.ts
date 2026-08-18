import { z } from "zod";
import { AI_COMPAT_TYPES } from "@/features/config/config.schema";

export const TestAiConnectionInputSchema = z.object({
  providerId: z.string().optional(),
  category: z.enum(["workers-ai", "third-party"]),
  compatType: z.enum(AI_COMPAT_TYPES).optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export type TestAiConnectionInput = z.infer<typeof TestAiConnectionInputSchema>;
