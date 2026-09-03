import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/middlewares";
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

/** 所有管理接口都附加可选 ownerId：仅超级管理员可用其查看/编辑其它账号导航，普通管理员忽略。 */
// 泛型约束需用 any 通配 Zod v4 的 ZodObject 五参签名，才能保留具体 shape 的输入/输出推断；
// 用 ZodRawShape 抽象约束会让 T["_output"]/T["_input"] 退化为 unknown，导致调用方类型丢失。
// biome-ignore lint/suspicious/noExplicitAny: 见上方说明，保留具体类型推断所必需。
const withOwnerId = <T extends z.ZodObject<any, any>>(schema: T) =>
  schema.extend({ ownerId: z.string().optional() }) as z.ZodType<
    T["_output"] & { ownerId?: string },
    T["_input"] & { ownerId?: string }
  >;

export const getAdminNavigationDataFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ ownerId: z.string().optional() }))
  .handler(
    async ({ data, context }) =>
      await NavigationService.getAdminNavigationData(context, data.ownerId),
  );

/** 列出可作为导航 owner 的账号（普通管理员 + 超管），供超管后台选择器使用。 */
export const getNavigationOwnerAccountsFn = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async ({ context }) =>
    NavigationService.getNavigationOwnerAccounts(context),
  );

export const createSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(createSearchEngineInputSchema(m)))
  .handler(
    async ({ data, context }) =>
      await NavigationService.createSearchEngine(context, data, data.ownerId),
  );

export const updateSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(updateSearchEngineInputSchema(m)))
  .handler(
    async ({ data, context }) =>
      await NavigationService.updateSearchEngine(context, data, data.ownerId),
  );

export const deleteSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(deleteSearchEngineInputSchema))
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteSearchEngine(context, data, data.ownerId),
  );

export const setDefaultSearchEngineFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(setDefaultSearchEngineInputSchema))
  .handler(
    async ({ data, context }) =>
      await NavigationService.setDefaultSearchEngine(context, data, data.ownerId),
  );

export const createFolderFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(createFolderInputSchema(m)))
  .handler(
    async ({ data, context }) =>
      await NavigationService.createFolder(context, data, data.ownerId),
  );

export const updateFolderFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(updateFolderInputSchema(m)))
  .handler(
    async ({ data, context }) =>
      await NavigationService.updateFolder(context, data, data.ownerId),
  );

export const deleteFolderFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(deleteFolderInputSchema))
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteFolder(context, data, data.ownerId),
  );

export const deleteFoldersFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(deleteFoldersInputSchema))
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteFolders(context, data, data.ownerId),
  );

export const createBookmarkFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(createBookmarkInputSchema(m)))
  .handler(
    async ({ data, context }) =>
      await NavigationService.createBookmark(context, data, data.ownerId),
  );

export const updateBookmarkFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(updateBookmarkInputSchema(m)))
  .handler(
    async ({ data, context }) =>
      await NavigationService.updateBookmark(context, data, data.ownerId),
  );

export const deleteBookmarkFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(deleteBookmarkInputSchema))
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteBookmark(context, data, data.ownerId),
  );

export const deleteBookmarksFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(deleteBookmarksInputSchema))
  .handler(
    async ({ data, context }) =>
      await NavigationService.deleteBookmarks(context, data, data.ownerId),
  );

export const importBookmarksFn = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .inputValidator(withOwnerId(importBookmarksInputSchema(m)))
  .handler(
    async ({ data, context }) =>
      await NavigationService.importBookmarks(context, data, data.ownerId),
  );
