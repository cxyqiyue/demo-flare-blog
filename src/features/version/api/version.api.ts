import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware, superAdminMiddleware } from "@/lib/middlewares";
import * as VersionService from "../service/version.service";

export const checkUpdateFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => VersionService.checkForUpdate(context));

export const forceCheckUpdateFn = createServerFn()
  .middleware([superAdminMiddleware])
  .handler(({ context }) => VersionService.checkForUpdate(context, true));
