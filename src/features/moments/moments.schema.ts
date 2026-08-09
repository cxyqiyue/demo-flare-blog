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

export const DeleteMomentInputSchema = z.object({
  id: z.number(),
});
export type DeleteMomentInput = z.infer<typeof DeleteMomentInputSchema>;

// === User inputs ===

export const ToggleMomentLikeInputSchema = z.object({
  momentId: z.number(),
});
export type ToggleMomentLikeInput = z.infer<typeof ToggleMomentLikeInputSchema>;

// === Cache ===
export const MomentsResponseSchema = z.array(MomentWithStatsSchema);

export const MOMENTS_CACHE_KEYS = {
  list: (version: string) => ["moments", "list", version] as const,
} as const;

// === Types ===
export type MomentWithStats = z.infer<typeof MomentWithStatsSchema>;
