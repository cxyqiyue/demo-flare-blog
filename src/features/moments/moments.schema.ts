import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { NullableJsonContentSchema } from "@/features/posts/schema/json-content.schema";
import { MomentsTable } from "@/lib/db/schema";

const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

export const MomentSelectSchema = createSelectSchema(MomentsTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
  images: z.array(z.string()),
  content: NullableJsonContentSchema,
});

export const MomentAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});

export const MomentWithStatsSchema = MomentSelectSchema.extend({
  author: MomentAuthorSchema.nullable(),
  likeCount: z.number(),
  commentCount: z.number(),
  isLiked: z.boolean(),
});

// === Admin inputs ===

export const CreateMomentInputSchema = z.object({
  content: NullableJsonContentSchema,
  images: z.array(z.string().min(1).max(2000)).max(9).default([]),
});
export type CreateMomentInput = z.infer<typeof CreateMomentInputSchema>;

export const UpdateMomentInputSchema = z.object({
  id: z.number(),
  content: NullableJsonContentSchema,
  images: z.array(z.string().min(1).max(2000)).max(9).default([]),
});
export type UpdateMomentInput = z.infer<typeof UpdateMomentInputSchema>;

export const DeleteMomentInputSchema = z.object({
  id: z.number(),
});
export type DeleteMomentInput = z.infer<typeof DeleteMomentInputSchema>;

// === User inputs ===

export const ToggleMomentLikeInputSchema = z.object({
  momentId: z.number(),
});
export type ToggleMomentLikeInput = z.infer<typeof ToggleMomentLikeInputSchema>;

export const GetPublicMomentsPageInputSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
});
export type GetPublicMomentsPageInput = z.infer<
  typeof GetPublicMomentsPageInputSchema
>;

// === Cache ===
export const MomentsResponseSchema = z.array(MomentWithStatsSchema);

export const MomentsPageResponseSchema = z.object({
  items: MomentsResponseSchema,
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});
export type MomentsPageResponse = z.infer<typeof MomentsPageResponseSchema>;

export const MOMENTS_CACHE_KEYS = {
  list: (version: string) => ["moments", "list", version] as const,
  publicPage: (version: string, offset: number, limit: number) =>
    ["moments", "public-page", version, offset, limit] as const,
} as const;

// === Types ===
export type MomentWithStats = z.infer<typeof MomentWithStatsSchema>;
