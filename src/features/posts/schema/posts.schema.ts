import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { TagSelectSchema } from "@/features/tags/tags.schema";
import type { Post, PostStatus, Tag } from "@/lib/db/schema";
import { POST_STATUSES, PostsTable } from "@/lib/db/schema";
import { NullableJsonContentSchema } from "./json-content.schema";

// Date fields need to accept both Date objects and ISO strings (for JSON serialization)
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);
const coercedDateNullable = coercedDate.nullable();

export const PostSelectSchema = createSelectSchema(PostsTable, {
  publishedAt: coercedDateNullable,
  pinnedAt: coercedDateNullable,
  createdAt: coercedDate,
  updatedAt: coercedDate,
})
  .omit({
    publicContentJson: true,
    // 三个字段均属敏感：publicContentJson 是预览快照；
    // passwordHash/passwordCipher 绝不进入公开 schema。
    passwordHash: true,
    passwordCipher: true,
  })
  // author 为文章作者（用户）的当前昵称；由 authorId 关联 user 表实时派生，
  // 因此作者昵称变更会同步到历史文章。
  .extend({
    author: z.string().nullable(),
    // 密码获取提示为可选内容：列表/部分公开响应不携带该字段。
    passwordHint: z.string().nullish(),
  });

/** 管理端专用：在 select 基础上追加解密后的明文访问密码 */
export const PostAdminSelectSchema = PostSelectSchema.extend({
  password: z.string().nullable(),
});
export const PostInsertSchema = createInsertSchema(PostsTable);
export const PostUpdateSchema = createUpdateSchema(PostsTable, {
  contentJson: NullableJsonContentSchema.optional(),
  publicContentJson: NullableJsonContentSchema.optional(),
})
  .omit({
    publicContentJson: true,
  })
  .extend({
    /**
     * 编辑器提交的明文访问密码（非 DB 列）。服务端在 updatePost 中据此派生
     * passwordHash/passwordCipher 后落库，明文不外传、不缓存。
     */
    password: z.string().max(512).optional(),
  });

export const PostItemSchema = PostSelectSchema.omit({
  contentJson: true,
}).extend({
  tags: z.array(TagSelectSchema).optional(),
});
export const PostListResponseSchema = z.object({
  items: z.array(PostItemSchema),
  nextCursor: z.number().nullable(),
});

/** 前台可见的受限门禁类型：私密 / 密码保护 */
export const POST_GATES = ["private", "password"] as const;
export const PostGateSchema = z.enum(POST_GATES);
export type PostGate = z.infer<typeof PostGateSchema>;

export const PostWithTocSchema = PostSelectSchema.extend({
  // 受限门禁时 contentJson/toc 为 null（壳不携带正文）
  contentJson: NullableJsonContentSchema,
  tags: z.array(TagSelectSchema).optional(),
  toc: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        level: z.number(),
      }),
    )
    .nullish(),
  gate: PostGateSchema.nullish(),
  passwordHint: z.string().nullish(),
}).nullable();

export function normalizePostTagName(
  tagName: string | undefined,
): string | undefined {
  return tagName === "" ? undefined : tagName;
}

export const PostTagNameSchema = z
  .string()
  .transform(normalizePostTagName)
  .optional();

export const GetPostsCursorInputSchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().optional(),
  tagName: PostTagNameSchema,
  excludePinned: z.boolean().optional(),
});

export const FindPostBySlugInputSchema = z.object({
  slug: z.string(),
});

export const FindRelatedPostsInputSchema = z.object({
  slug: z.string(),
  limit: z.number().optional(),
});

/** Offset-based pagination for public post lists (e.g. home page). */
export const GetPublicPostsPageInputSchema = z.object({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const PublicPostsPageResponseSchema = z.object({
  items: z.array(PostItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export const AdjacentPostSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  publishedAt: coercedDateNullable,
});

export const AdjacentPostsResponseSchema = z.object({
  previous: AdjacentPostSchema.nullable(),
  next: AdjacentPostSchema.nullable(),
});

export const FindAdjacentPostsInputSchema = z.object({
  slug: z.string(),
});

export type GetPostsCursorInput = z.infer<typeof GetPostsCursorInputSchema>;
export type FindPostBySlugInput = z.infer<typeof FindPostBySlugInputSchema>;
export type FindRelatedPostsInput = z.infer<typeof FindRelatedPostsInputSchema>;
export type GetPublicPostsPageInput = z.infer<
  typeof GetPublicPostsPageInputSchema
>;
export type PublicPostsPageResponse = z.infer<
  typeof PublicPostsPageResponseSchema
>;
export type AdjacentPostsResponse = z.infer<typeof AdjacentPostsResponseSchema>;
export type FindAdjacentPostsInput = z.infer<
  typeof FindAdjacentPostsInputSchema
>;
export type AdjacentPost = z.infer<typeof AdjacentPostSchema>;

// Admin API Schemas
export const GenerateSlugInputSchema = z.object({
  title: z.string().optional(),
  excludeId: z.number().optional(),
});

export const GetPostsInputSchema = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
  status: z.custom<PostStatus>().optional(),
  publicOnly: z.boolean().optional(),
  search: z.string().optional(),
  sortDir: z.enum(["ASC", "DESC"]).optional(),
  sortBy: z.enum(["publishedAt", "updatedAt"]).optional(),
});

export const GetPostsCountInputSchema = GetPostsInputSchema.omit({
  offset: true,
  limit: true,
  sortDir: true,
});

export const FindPostByIdInputSchema = z.object({ id: z.number() });

export const UpdatePostInputSchema = z.object({
  id: z.number(),
  data: PostUpdateSchema,
});

export const DeletePostInputSchema = z.object({ id: z.number() });

export const BatchUpdatePostsStatusInputSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  status: z.enum(POST_STATUSES),
});

export const PreviewSummaryInputSchema = PostSelectSchema.pick({
  contentJson: true,
});

export const StartPostProcessInputSchema = z.object({
  id: z.number(),
  status: z.enum(POST_STATUSES),
  clientToday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const GenerateArticleInputSchema = z.object({
  outline: z.string().min(1).max(20000),
  title: z.string().max(200).optional(),
  language: z.string().max(50).optional(),
  tone: z.string().max(50).optional(),
  targetLength: z.number().int().positive().max(20000).optional(),
});

export type GenerateSlugInput = z.infer<typeof GenerateSlugInputSchema>;
export type GetPostsInput = z.infer<typeof GetPostsInputSchema>;
export type GetPostsCountInput = z.infer<typeof GetPostsCountInputSchema>;
export type FindPostByIdInput = z.infer<typeof FindPostByIdInputSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;
export type DeletePostInput = z.infer<typeof DeletePostInputSchema>;
export type BatchUpdatePostsStatusInput = z.infer<
  typeof BatchUpdatePostsStatusInputSchema
>;
export type PreviewSummaryInput = z.infer<typeof PreviewSummaryInputSchema>;
export type StartPostProcessInput = z.infer<typeof StartPostProcessInputSchema>;
export type GenerateArticleInput = z.infer<typeof GenerateArticleInputSchema>;
export type PostListItem = Omit<
  Post,
  | "contentJson"
  | "publicContentJson"
  | "passwordHash"
  | "passwordCipher"
  | "passwordHint"
> & {
  tags?: Array<Tag>;
  /** 作者昵称（由 authorId 关联 user 表实时派生） */
  author: string | null;
};

export type PostListResponse = z.infer<typeof PostListResponseSchema>;
export type PostItem = z.infer<typeof PostItemSchema>;
export type PostWithToc = z.infer<typeof PostWithTocSchema>;

export const POSTS_CACHE_KEYS = {
  list: (
    version: string,
    limit: number,
    cursor: number,
    tagName?: string,
    scope: "public" | "admin" = "public",
  ) =>
    tagName === undefined
      ? (["posts", "list", scope, version, limit, cursor, "all"] as const)
      : (["posts", "list", scope, version, limit, cursor, "tag", tagName] as const),
  detail: (version: string, slug: string) => [version, "post", slug] as const,
  /** 受限文章的门禁壳（无正文，可公共缓存；正文响应一律 no-store） */
  detailGated: (version: string, slug: string) =>
    [version, "post", slug, "gate"] as const,
  related: (slug: string, limit?: number) =>
    ["posts", "related-ids", slug, limit] as const,
  syncHash: (id: number) => `post_hash:${id}` as const,
    publicPage: (version: string, offset: number, limit: number, scope: "public" | "admin" = "public") =>
      [version, "posts", "page", scope, offset, limit] as const,
  adjacent: (version: string, slug: string) =>
    [version, "post", slug, "adjacent"] as const,
} as const;
