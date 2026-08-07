import { z } from "zod";

export const TestAiConnectionInputSchema = z.object({
  provider: z.enum(["workers-ai", "openai-compatible", "agnes-ai"]),
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
});

export type TestAiConnectionInput = z.infer<typeof TestAiConnectionInputSchema>;
