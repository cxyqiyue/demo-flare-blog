import { createServerFn } from "@tanstack/react-start";
import {
  TestImageHostingConnectionInputSchema,
  UploadImageHostingInputSchema,
} from "@/features/image-hosting/image-hosting.schema";
import * as ImageHostingService from "@/features/image-hosting/image-hosting.service";
import {
  authMiddleware,
  createRateLimitMiddleware,
  dbMiddleware,
  superAdminMiddleware,
} from "@/lib/middlewares";

export const uploadToImageHostingFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(UploadImageHostingInputSchema)
  .handler(({ data, context }) =>
    ImageHostingService.uploadForArticle(context, data),
  );

export const testImageHostingConnectionFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(TestImageHostingConnectionInputSchema)
  .handler(({ data }) => ImageHostingService.testConnection(data));

export const uploadCommentImageFn = createServerFn({
  method: "POST",
})
  .middleware([
    createRateLimitMiddleware({
      capacity: 200,
      interval: "1h",
      key: "image-hosting:comment-upload",
      identifierPriority: "session",
    }),
    authMiddleware,
  ])
  .inputValidator(UploadImageHostingInputSchema)
  .handler(({ data, context }) =>
    ImageHostingService.uploadCommentImage(context, data),
  );

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
