import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { SkillsTable } from "@/lib/db/schema";

// Date fields need to accept both Date objects and ISO strings (for JSON serialization)
const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);

export const SkillSelectSchema = createSelectSchema(SkillsTable, {
  createdAt: coercedDate,
  updatedAt: coercedDate,
});
export const SkillInsertSchema = createInsertSchema(SkillsTable);
export const SkillUpdateSchema = createUpdateSchema(SkillsTable);

export const SkillWithCountSchema = SkillSelectSchema.extend({
  postCount: z.number(),
});

// API Input Schemas
export const CreateSkillInputSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(1000).optional(),
});

export const UpdateSkillInputSchema = z.object({
  id: z.number(),
  data: z.object({
    name: z.string().min(1).max(60).optional(),
    description: z.string().max(1000).optional(),
  }),
});

export const DeleteSkillInputSchema = z.object({
  id: z.number(),
});

export const ImportSkillsInputSchema = z.object({
  markdown: z.string().min(1).max(30000),
});

export const GetSkillsInputSchema = z.object({
  sortBy: z.enum(["name", "createdAt", "postCount"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const GetSkillByIdInputSchema = z.object({
  id: z.number(),
});

// Type exports
export type Skill = z.infer<typeof SkillSelectSchema>;
export type CreateSkillInput = z.infer<typeof CreateSkillInputSchema>;
export type UpdateSkillInput = z.infer<typeof UpdateSkillInputSchema>;
export type DeleteSkillInput = z.infer<typeof DeleteSkillInputSchema>;
export type ImportSkillsInput = z.infer<typeof ImportSkillsInputSchema>;
export type GetSkillsInput = z.infer<typeof GetSkillsInputSchema>;
export type GetSkillByIdInput = z.infer<typeof GetSkillByIdInputSchema>;
export type SkillWithCount = z.infer<typeof SkillWithCountSchema>;
