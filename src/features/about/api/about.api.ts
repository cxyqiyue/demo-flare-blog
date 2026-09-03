import { createServerFn } from "@tanstack/react-start";
import { SaveAboutArticleInputSchema } from "@/features/about/about.schema";
import * as AboutService from "@/features/about/about.service";
import { dbMiddleware, superAdminMiddleware } from "@/lib/middlewares";

export const getAboutArticleFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(({ context }) => AboutService.getAboutArticle(context));

export const saveAboutArticleFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(SaveAboutArticleInputSchema)
  .handler(({ data, context }) => AboutService.saveAboutArticle(context, data));
