import { createServerFn } from "@tanstack/react-start";
import { TestAiConnectionInputSchema } from "@/features/ai/ai.schema";
import * as AiService from "@/features/ai/ai.service";
import { adminMiddleware } from "@/lib/middlewares";

export const testAiConnectionFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(TestAiConnectionInputSchema)
  .handler(({ data, context }) => AiService.testAiConnection(context, data));
