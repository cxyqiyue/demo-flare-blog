import { createServerFn } from "@tanstack/react-start";
import * as CacheService from "@/features/cache/cache.service";
import { superAdminMiddleware } from "@/lib/middlewares";

export const invalidateSiteCacheFn = createServerFn()
  .middleware([superAdminMiddleware])
  .handler(async ({ context }) => CacheService.invalidateSiteCache(context));
