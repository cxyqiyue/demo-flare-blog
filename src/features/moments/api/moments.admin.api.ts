import { createServerFn } from "@tanstack/react-start";
import { superAdminMiddleware } from "@/lib/middlewares";
import {
  CreateMomentInputSchema,
  DeleteMomentInputSchema,
  UpdateMomentInputSchema,
} from "../moments.schema";
import * as MomentService from "../moments.service";

export const createMomentFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(CreateMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.createMoment(context, data),
  );

export const updateMomentFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(UpdateMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.updateMoment(context, data),
  );

export const deleteMomentFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(DeleteMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.deleteMoment(context, data),
  );
