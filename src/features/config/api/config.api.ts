import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseSiteAssetUploadInput } from "@/features/config/config.asset.schema";
import {
  SystemConfigSchema,
  UpdateSystemConfigSectionInputSchema,
} from "@/features/config/config.schema";
import * as ConfigService from "@/features/config/service/config.service";
import { adminMiddleware, superAdminMiddleware } from "@/lib/middlewares";
import { m } from "@/paraglide/messages";

export const getSystemConfigFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => ConfigService.getSystemConfig(context));

export const updateSystemConfigFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(SystemConfigSchema)
  .handler(({ context, data }) =>
    ConfigService.updateSystemConfig(context, data),
  );

export const updateSystemConfigSectionFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(UpdateSystemConfigSectionInputSchema)
  .handler(({ context, data }) =>
    ConfigService.updateSystemConfigSection(context, data),
  );

const SiteAssetUploadInputSchema = z.instanceof(FormData);

export const uploadSiteAssetFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(SiteAssetUploadInputSchema)
  .handler(async ({ data, context }) => {
    const input = parseSiteAssetUploadInput(data, m);
    return ConfigService.uploadSiteAsset(context, input);
  });
