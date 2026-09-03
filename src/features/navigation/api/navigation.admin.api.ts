import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware, superAdminMiddleware } from "@/lib/middlewares";
import { m } from "@/paraglide/messages";
import {
  createBookmarkInputSchema,
  createFolderInputSchema,
  createSearchEngineInputSchema,
  deleteBookmarkInputSchema,
  deleteBookmarksInputSchema,
  deleteFolderInputSchema,
  deleteFoldersInputSchema,
  deleteSearchEngineInputSchema,
  importBookmarksInputSchema,
  setDefaultSearchEngineInputSchema,
  updateBookmarkInputSchema,
  updateFolderInputSchema,
  updateSearchEngineInputSchema,
} from "../navigation.schema";
import * as NavigationService from "../navigation.service";

export const getAdminNavigationDataFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(
    async ({ context }) =>
      await NavigationService.getAdminNavigationData(context),
  );

export const createSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(createSearchEngineInputSchema(m))
  .handler(
    async ({ data, context }) =>
      await NavigationService.createSearchEngine(context, data),
  );

export const updateSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(updateSearchEngineInputSchema(m))
  .handler(
    async ({ data, context }) =>
      await NavigationService.updateSearchEngine(context, data),
  );

export const deleteSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(deleteSearchEngineInputSchema)
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteSearchEngine(context, data),
  );

export const setDefaultSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(setDefaultSearchEngineInputSchema)
  .handler(
    async ({ data, context }) =>
      await NavigationService.setDefaultSearchEngine(context, data),
  );

export const createFolderFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(createFolderInputSchema(m))
  .handler(
    async ({ data, context }) =>
      await NavigationService.createFolder(context, data),
  );

export const updateFolderFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(updateFolderInputSchema(m))
  .handler(
    async ({ data, context }) =>
      await NavigationService.updateFolder(context, data),
  );

export const deleteFolderFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(deleteFolderInputSchema)
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteFolder(context, data),
  );

export const deleteFoldersFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(deleteFoldersInputSchema)
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteFolders(context, data),
  );

export const createBookmarkFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(createBookmarkInputSchema(m))
  .handler(
    async ({ data, context }) =>
      await NavigationService.createBookmark(context, data),
  );

export const updateBookmarkFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(updateBookmarkInputSchema(m))
  .handler(
    async ({ data, context }) =>
      await NavigationService.updateBookmark(context, data),
  );

export const deleteBookmarkFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(deleteBookmarkInputSchema)
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteBookmark(context, data),
  );

export const deleteBookmarksFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(deleteBookmarksInputSchema)
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteBookmarks(context, data),
  );

export const importBookmarksFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(importBookmarksInputSchema(m))
  .handler(
    async ({ data, context }) =>
      await NavigationService.importBookmarks(context, data),
  );
