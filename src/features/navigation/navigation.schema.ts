import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  BookmarkFoldersTable,
  BookmarksTable,
  SearchEnginesTable,
} from "@/lib/db/schema";
import type { Messages } from "@/lib/i18n";

const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

// ==================== Select schemas ====================

export const SearchEngineSelectSchema = createSelectSchema(SearchEnginesTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

export const BookmarkFolderSelectSchema = createSelectSchema(
  BookmarkFoldersTable,
  {
    createdAt: coercedDate,
    updatedAt: coercedDate,
  },
);

export const BookmarkSelectSchema = createSelectSchema(BookmarksTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

// ==================== Public response ====================

export const NavigationPublicDataSchema = z.object({
  engines: z.array(
    SearchEngineSelectSchema.pick({
      id: true,
      name: true,
      urlTemplate: true,
      iconUrl: true,
      domain: true,
      isDefault: true,
      enabled: true,
      sortOrder: true,
    }),
  ),
  folders: z.array(
    BookmarkFolderSelectSchema.pick({
      id: true,
      name: true,
      sortOrder: true,
    }).extend({
      bookmarkCount: z.number(),
    }),
  ),
  bookmarks: z.array(
    BookmarkSelectSchema.pick({
      id: true,
      folderId: true,
      name: true,
      url: true,
      sortOrder: true,
    }),
  ),
});

// ==================== Cache ====================
export const NAVIGATION_CACHE_KEYS = {
  publicData: (version: string) =>
    ["navigation", "public", version] as const,
} as const;

// ==================== Admin inputs ====================

export const createSearchEngineInputSchema = (m: Messages) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, m.navigation_validation_required({ label: m.navigation_field_name() }))
      .max(100, m.navigation_validation_too_long({ max: 100 })),
    urlTemplate: z
      .string()
      .trim()
      .min(
        1,
        m.navigation_validation_required({ label: m.navigation_field_url() }),
      )
      .refine(
        (value) => value.includes("{query}"),
        m.navigation_validation_query_placeholder({ query: "{query}" }),
      ),
    iconUrl: z.union([z.literal(""), z.string().url().max(500)]).optional(),
    domain: z
      .string()
      .trim()
      .min(
        1,
        m.navigation_validation_required({ label: m.navigation_field_domain() }),
      )
      .max(253, m.navigation_validation_too_long({ max: 253 })),
    sortOrder: z.number().int().min(0).max(10000).default(0),
    enabled: z.boolean().default(true),
    isDefault: z.boolean().default(false),
  });

export const updateSearchEngineInputSchema = (m: Messages) =>
  createSearchEngineInputSchema(m).partial().extend({
    id: z.number(),
  });

export const deleteSearchEngineInputSchema = z.object({
  id: z.number(),
});

export const setDefaultSearchEngineInputSchema = z.object({
  id: z.number(),
});

export const createFolderInputSchema = (m: Messages) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(
        1,
        m.navigation_validation_required({ label: m.navigation_field_folder_name() }),
      )
      .max(50, m.navigation_validation_too_long({ max: 50 })),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  });

export const updateFolderInputSchema = (m: Messages) =>
  createFolderInputSchema(m).partial().extend({
    id: z.number(),
  });

export const deleteFolderInputSchema = z.object({
  id: z.number(),
});

export const createBookmarkInputSchema = (m: Messages) =>
  z.object({
    folderId: z.number().nullable().default(null),
    name: z
      .string()
      .trim()
      .min(
        1,
        m.navigation_validation_required({ label: m.navigation_field_bookmark_name() }),
      )
      .max(100, m.navigation_validation_too_long({ max: 100 })),
    url: z
      .string()
      .trim()
      .min(
        1,
        m.navigation_validation_required({ label: m.navigation_field_bookmark_url() }),
      )
      .refine(
        (value) => value.startsWith("http://") || value.startsWith("https://"),
        m.navigation_validation_invalid_url(),
      ),
    sortOrder: z.number().int().min(0).max(10000).default(0),
  });

export const updateBookmarkInputSchema = (m: Messages) =>
  createBookmarkInputSchema(m).partial().extend({
    id: z.number(),
  });

export const deleteBookmarkInputSchema = z.object({
  id: z.number(),
});

// 书签导入：由前端解析浏览器导出的 Netscape 书签 HTML 后提交
export const importBookmarksInputSchema = (m: Messages) =>
  z.object({
    replace: z.boolean().default(false),
    items: z
      .array(
        z.object({
          folderName: z
            .string()
            .trim()
            .max(50, m.navigation_validation_too_long({ max: 50 }))
            .optional(),
          bookmarks: z
            .array(
              z.object({
                name: z
                  .string()
                  .trim()
                  .min(
                    1,
                    m.navigation_validation_required({ label: m.navigation_field_bookmark_name() }),
                  )
                  .max(100, m.navigation_validation_too_long({ max: 100 })),
                url: z
                  .string()
                  .trim()
                  .refine(
                    (value) =>
                      value.startsWith("http://") ||
                      value.startsWith("https://"),
                    m.navigation_validation_invalid_url(),
                  ),
              }),
            )
            .max(2000, m.navigation_validation_too_long({ max: 2000 })),
        }),
      )
      .max(1000, m.navigation_validation_too_long({ max: 1000 })),
  });

// ==================== Types ====================
export type SearchEngineSelect = z.infer<typeof SearchEngineSelectSchema>;
export type BookmarkFolderSelect = z.infer<typeof BookmarkFolderSelectSchema>;
export type BookmarkSelect = z.infer<typeof BookmarkSelectSchema>;
export type NavigationPublicData = z.infer<typeof NavigationPublicDataSchema>;
export type CreateSearchEngineInput = z.input<
  ReturnType<typeof createSearchEngineInputSchema>
>;
export type CreateSearchEngineFormValues = z.input<
  ReturnType<typeof createSearchEngineInputSchema>
>;
export type UpdateSearchEngineInput = z.input<
  ReturnType<typeof updateSearchEngineInputSchema>
>;
export type DeleteSearchEngineInput = z.infer<
  typeof deleteSearchEngineInputSchema
>;
export type SetDefaultSearchEngineInput = z.infer<
  typeof setDefaultSearchEngineInputSchema
>;
export type CreateFolderInput = z.input<
  ReturnType<typeof createFolderInputSchema>
>;
export type CreateFolderFormValues = z.input<
  ReturnType<typeof createFolderInputSchema>
>;
export type UpdateFolderInput = z.input<ReturnType<typeof updateFolderInputSchema>>;
export type DeleteFolderInput = z.infer<typeof deleteFolderInputSchema>;
export type CreateBookmarkInput = z.input<
  ReturnType<typeof createBookmarkInputSchema>
>;
export type CreateBookmarkFormValues = z.input<
  ReturnType<typeof createBookmarkInputSchema>
>;
export type UpdateBookmarkInput = z.input<
  ReturnType<typeof updateBookmarkInputSchema>
>;
export type DeleteBookmarkInput = z.infer<typeof deleteBookmarkInputSchema>;
export type ImportBookmarksInput = z.input<
  ReturnType<typeof importBookmarksInputSchema>
>;
export type ImportBookmarksFormValues = z.input<
  ReturnType<typeof importBookmarksInputSchema>
>;
