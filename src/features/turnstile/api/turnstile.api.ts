import { createServerFn } from "@tanstack/react-start";
import * as TurnstileService from "@/features/turnstile/service/turnstile.service";
import { dbMiddleware } from "@/lib/middlewares";

export const getTurnstileConfigFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(({ context }) => TurnstileService.getTurnstileClientConfig(context));
