import { createServerFn } from "@tanstack/react-start";
import { dbMiddleware } from "@/lib/middlewares";
import { GetMomentsInputSchema } from "../moments.schema";
import * as MomentsService from "../moments.service";

export const getPublicMomentsFn = createServerFn()
  .middleware([dbMiddleware])
  .inputValidator(GetMomentsInputSchema)
  .handler(async ({ data, context }) => {
    return await MomentsService.getPublicMoments(context, data);
  });
