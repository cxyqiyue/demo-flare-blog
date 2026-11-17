import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import * as CacheService from "@/features/cache/cache.service";
import { buildPostWhereClause } from "@/features/posts/data/helper";
import {
  CategoriesTable,
  PostCategoriesTable,
  PostsTable,
} from "@/lib/db/schema";
import { purgeCDNCache } from "@/lib/invalidate";
import {
  adminMiddleware,
  dbMiddleware,
  superAdminMiddleware,
} from "@/lib/middlewares";

export const getCategoriesFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    return context.db
      .select({
        id: CategoriesTable.id,
        name: CategoriesTable.name,
        postCount: count(PostsTable.id),
      })
      .from(CategoriesTable)
      .leftJoin(
        PostCategoriesTable,
        eq(PostCategoriesTable.publicCategoryId, CategoriesTable.id),
      )
      .leftJoin(
        PostsTable,
        and(
          eq(PostsTable.id, PostCategoriesTable.postId),
          buildPostWhereClause({ publicOnly: true }),
        ),
      )
      .groupBy(CategoriesTable.id)
      .orderBy(asc(CategoriesTable.name));
  });

export const createCategoryFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(z.object({ name: z.string().trim().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    await context.db.insert(CategoriesTable).values(data).onConflictDoNothing();
    return context.db
      .select()
      .from(CategoriesTable)
      .where(eq(CategoriesTable.name, data.name))
      .get();
  });

export const getCategoriesAdminFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) =>
    context.db
      .select()
      .from(CategoriesTable)
      .orderBy(asc(CategoriesTable.name)),
  );

export const updateCategoryFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(80),
    }),
  )
  .handler(async ({ context, data }) => {
    const existing = await context.db
      .select()
      .from(CategoriesTable)
      .where(eq(CategoriesTable.name, data.name))
      .get();
    if (existing && existing.id !== data.id) throw new Error("分类名称已存在");
    await context.db
      .update(CategoriesTable)
      .set({ name: data.name })
      .where(eq(CategoriesTable.id, data.id));
    await Promise.all([
      CacheService.bumpVersion(context, "posts:list"),
      CacheService.bumpVersion(context, "posts:detail"),
      purgeCDNCache(context.env, { prefixes: ["/"] }),
    ]);
    return { success: true };
  });

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    await context.db
      .delete(CategoriesTable)
      .where(eq(CategoriesTable.id, data.id));
    await Promise.all([
      CacheService.bumpVersion(context, "posts:list"),
      CacheService.bumpVersion(context, "posts:detail"),
      purgeCDNCache(context.env, { prefixes: ["/"] }),
    ]);
    return { success: true };
  });
