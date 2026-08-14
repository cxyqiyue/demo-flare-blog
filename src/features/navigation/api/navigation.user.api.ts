import { createServerFn } from "@tanstack/react-start";
import { dbMiddleware } from "@/lib/middlewares";
import * as NavigationService from "../navigation.service";

export const getNavigationPublicDataFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    return await NavigationService.getNavigationPublicData(context);
  });
