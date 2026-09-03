import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware, superAdminMiddleware } from "@/lib/middlewares";
import {
  CreateAnnouncementInputSchema,
  DeleteAnnouncementInputSchema,
  ListAnnouncementDeliveriesInputSchema,
  ListAnnouncementsInputSchema,
  ResendAnnouncementInputSchema,
  SendAnnouncementInputSchema,
  UpdateAnnouncementInputSchema,
} from "../announcements.schema";
import * as AnnouncementService from "../announcements.service";

export const listAnnouncementsFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(ListAnnouncementsInputSchema)
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.listAnnouncements(context, data),
  );

export const getAnnouncementDetailFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(z.object({ id: z.number().int().positive() }))
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.getAnnouncementDetail(context, data),
  );

export const listAnnouncementDeliveriesFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(ListAnnouncementDeliveriesInputSchema)
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.listAnnouncementDeliveries(context, data),
  );

export const createAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(CreateAnnouncementInputSchema)
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.createAnnouncement(context, data),
  );

export const updateAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(UpdateAnnouncementInputSchema)
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.updateAnnouncement(context, data),
  );

export const deleteAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(DeleteAnnouncementInputSchema)
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.deleteAnnouncement(context, data),
  );

export const sendAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(SendAnnouncementInputSchema)
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.sendAnnouncement(context, data),
  );

export const resendAnnouncementFn = createServerFn({ method: "POST" })
  .middleware([superAdminMiddleware])
  .inputValidator(ResendAnnouncementInputSchema)
  .handler(
    async ({ data, context }) =>
      await AnnouncementService.resendAnnouncement(context, data),
  );