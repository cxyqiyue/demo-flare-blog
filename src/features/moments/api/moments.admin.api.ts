import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/middlewares";
import {
  CreateMomentInputSchema,
  DeleteMomentInputSchema,
  GetAllMomentsInputSchema,
  UpdateMomentInputSchema,
} from "../moments.schema";
import * as MomentsService from "../moments.service";

export const getAllMomentsFn = createServerFn()
  .middleware([adminMiddleware])
  .inputValidator(GetAllMomentsInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentsService.getAllMoments(context, data),
  );

export const createMomentFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(CreateMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentsService.createMoment(context, data),
  );

export const updateMomentFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UpdateMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentsService.updateMoment(context, data),
  );

export const deleteMomentFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(DeleteMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentsService.deleteMoment(context, data),
  );
