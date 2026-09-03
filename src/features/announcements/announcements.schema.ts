import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  AnnouncementDeliveriesTable,
  AnnouncementsTable,
} from "@/lib/db/schema";

const coercedDate = z.union([z.date(), z.string().pipe(z.coerce.date())]);
const coercedDateNullable = coercedDate.nullable();

export const AnnouncementSelectSchema = createSelectSchema(AnnouncementsTable, {
  sentAt: coercedDateNullable,
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

export const AnnouncementDeliverySelectSchema = createSelectSchema(
  AnnouncementDeliveriesTable,
  {
    createdAt: coercedDate,
    updatedAt: coercedDate,
  },
);

// === Draft (create) inputs ===
export const CreateAnnouncementInputSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
});

export const UpdateAnnouncementInputSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().min(1).optional(),
});

export const DeleteAnnouncementInputSchema = z.object({
  id: z.number().int().positive(),
});

export const SendAnnouncementInputSchema = z.object({
  id: z.number().int().positive(),
});

export const ListAnnouncementsInputSchema = z.object({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const ListAnnouncementDeliveriesInputSchema = z.object({
  announcementId: z.number().int().positive(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  status: z.enum(["pending", "sent", "failed"]).optional(),
});

export const ResendAnnouncementInputSchema = z.object({
  id: z.number().int().positive(),
  // 不传则为全部非 sent 投递；传 userIds 则只重发这些用户
  userIds: z.array(z.string()).optional(),
});

// === Response shapes ===
export const AnnouncementDeliveryStatsSchema = z.object({
  total: z.number(),
  pending: z.number(),
  sent: z.number(),
  failed: z.number(),
});

export const AnnouncementDetailSchema = AnnouncementSelectSchema.extend({
  deliveryStats: AnnouncementDeliveryStatsSchema,
});

export const AnnouncementDeliveryRowSchema =
  AnnouncementDeliverySelectSchema.extend({
    userName: z.string().nullable(),
  });

// === Cache keys ===
export const ANNOUNCEMENTS_CACHE_KEYS = {
  list: (offset: number, limit: number) =>
    ["announcements", "list", offset, limit] as const,
  detail: (id: number) => ["announcements", "detail", id] as const,
  deliveries: (announcementId: number, offset: number, limit: number) =>
    ["announcements", "deliveries", announcementId, offset, limit] as const,
} as const;

// === Types ===
export type CreateAnnouncementInput = z.infer<
  typeof CreateAnnouncementInputSchema
>;
export type UpdateAnnouncementInput = z.infer<
  typeof UpdateAnnouncementInputSchema
>;
export type DeleteAnnouncementInput = z.infer<
  typeof DeleteAnnouncementInputSchema
>;
export type SendAnnouncementInput = z.infer<typeof SendAnnouncementInputSchema>;
export type ListAnnouncementsInput = z.infer<
  typeof ListAnnouncementsInputSchema
>;
export type ListAnnouncementDeliveriesInput = z.infer<
  typeof ListAnnouncementDeliveriesInputSchema
>;
export type ResendAnnouncementInput = z.infer<
  typeof ResendAnnouncementInputSchema
>;
export type AnnouncementDeliveryStats = z.infer<
  typeof AnnouncementDeliveryStatsSchema
>;
export type AnnouncementDetail = z.infer<typeof AnnouncementDetailSchema>;
export type AnnouncementDeliveryRow = z.infer<
  typeof AnnouncementDeliveryRowSchema
>;