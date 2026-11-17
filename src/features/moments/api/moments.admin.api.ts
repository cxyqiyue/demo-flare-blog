import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/middlewares";
import {
  CreateMomentInputSchema,
  DeleteMomentInputSchema,
  UpdateMomentInputSchema,
} from "../moments.schema";
import * as MomentService from "../moments.service";

export const createMomentFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(CreateMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.createMoment(context, data),
  );

export const updateMomentFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UpdateMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.updateMoment(context, data),
  );

export const deleteMomentFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(DeleteMomentInputSchema)
  .handler(
    async ({ data, context }) =>
      await MomentService.deleteMoment(context, data),
  );
