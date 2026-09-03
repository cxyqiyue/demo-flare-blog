import { createServerFn } from "@tanstack/react-start";
import {
  DeleteSearchDocSchema,
  UpsertSearchDocSchema,
} from "@/features/search/search.schema";
import * as SearchService from "@/features/search/service/search.service";
import { dbMiddleware, superAdminMiddleware } from "@/lib/middlewares";

export const buildSearchIndexFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .handler(({ context }) => SearchService.rebuildIndex(context));

export const upsertSearchDocFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(UpsertSearchDocSchema)
  .handler(({ data, context }) =>
    SearchService.upsert(context, data, { immediate: true }),
  );

export const deleteSearchDocFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(DeleteSearchDocSchema)
  .handler(({ data, context }) =>
    SearchService.deleteIndex(context, data, { immediate: true }),
  );

export const getIndexVersionFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(({ context }) => SearchService.getIndexVersion(context));
