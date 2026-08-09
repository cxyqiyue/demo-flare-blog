import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { MomentsTable } from "@/lib/db/schema";
import type { Messages } from "@/lib/i18n";

const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

export const MomentSelectSchema = createSelectSchema(MomentsTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

export const MomentAuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});

export const MomentWithAuthorSchema = MomentSelectSchema.extend({
  author: MomentAuthorSchema.nullable(),
});

// === Public list input ===
export const GetMomentsInputSchema = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
});

// === Admin inputs ===
export const GetAllMomentsInputSchema = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export const CreateMomentInputSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const createCreateMomentSchema = (m: Messages) =>
  z.object({
    content: z
      .string()
      .min(1, m.moments_validation_required())
      .max(2000, m.moments_validation_too_long({ max: 2000 })),
  });

export const UpdateMomentInputSchema = z.object({
  id: z.number(),
  content: z.string().min(1).max(2000),
});

export const createUpdateMomentSchema = (m: Messages) =>
  z.object({
    id: z.number(),
    content: z
      .string()
      .min(1, m.moments_validation_required())
      .max(2000, m.moments_validation_too_long({ max: 2000 })),
  });

export const DeleteMomentInputSchema = z.object({
  id: z.number(),
});

// === Cache ===
export const MomentListResponseSchema = z.object({
  items: z.array(MomentWithAuthorSchema),
  total: z.number(),
  hasNext: z.boolean(),
});

export const MOMENTS_CACHE_KEYS = {
  publicList: (version: string) => ["moments", "public", version] as const,
} as const;

// === Types ===
export type GetMomentsInput = z.infer<typeof GetMomentsInputSchema>;
export type GetAllMomentsInput = z.infer<typeof GetAllMomentsInputSchema>;
export type CreateMomentInput = z.infer<typeof CreateMomentInputSchema>;
export type UpdateMomentInput = z.infer<typeof UpdateMomentInputSchema>;
export type DeleteMomentInput = z.infer<typeof DeleteMomentInputSchema>;
export type MomentWithAuthor = z.infer<typeof MomentWithAuthorSchema>;
