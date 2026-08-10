import { z } from "zod";

const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);
const coercedDateNullable = coercedDate.nullable();

export const UserAdminItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  banExpires: coercedDateNullable,
  createdAt: coercedDate,
  isSuperAdmin: z.boolean(),
  totalComments: z.number(),
});

export const CurrentAdminSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  isSuperAdmin: z.boolean(),
});

export const GetUsersResponseSchema = z.object({
  items: z.array(UserAdminItemSchema),
  total: z.number(),
  currentUser: CurrentAdminSchema,
});

export const GetUsersInputSchema = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
});

export const SetUserRoleInputSchema = z.object({
  userId: z.string(),
  role: z.enum(["admin", "user"]),
});

export const BanUserInputSchema = z.object({
  userId: z.string(),
  reason: z.string().max(500).optional(),
});

export const UnbanUserInputSchema = z.object({
  userId: z.string(),
});

export const UserManageErrorSchema = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal("NOT_FOUND") }),
  z.object({ reason: z.literal("PROTECTED_USER") }),
  z.object({ reason: z.literal("PERMISSION_DENIED") }),
]);

// === Types ===
export type GetUsersInput = z.infer<typeof GetUsersInputSchema>;
export type GetUsersResponse = z.infer<typeof GetUsersResponseSchema>;
export type UserAdminItem = z.infer<typeof UserAdminItemSchema>;
export type CurrentAdmin = z.infer<typeof CurrentAdminSchema>;
export type SetUserRoleInput = z.infer<typeof SetUserRoleInputSchema>;
export type BanUserInput = z.infer<typeof BanUserInputSchema>;
export type UnbanUserInput = z.infer<typeof UnbanUserInputSchema>;
export type UserManageError = z.infer<typeof UserManageErrorSchema>;
