import { createServerFn } from "@tanstack/react-start";
import * as ImageHostingService from "@/features/image-hosting/image-hosting.service";
import {
  TestImageHostingConnectionInputSchema,
  UploadImageHostingInputSchema,
} from "@/features/image-hosting/image-hosting.schema";
import { adminMiddleware, dbMiddleware } from "@/lib/middlewares";

export const uploadToImageHostingFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UploadImageHostingInputSchema)
  .handler(({ data, context }) =>
    ImageHostingService.uploadForArticle(context, data),
  );

export const testImageHostingConnectionFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(TestImageHostingConnectionInputSchema)
  .handler(({ data }) => ImageHostingService.testConnection(data));

export const getCommentImageHostingConfigFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(({ context }) =>
    ImageHostingService.getCommentImageHostingConfig(context),
  );

export const getArticleImageHostingConfigFn = createServerFn()
  .middleware([dbMiddleware])
  .handler(({ context }) =>
    ImageHostingService.getArticleImageHostingConfig(context),
  );
