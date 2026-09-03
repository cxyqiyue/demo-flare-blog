import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware, superAdminMiddleware } from "@/lib/middlewares";
import {
  DeleteOAuthConnectionInputSchema,
  RenameOAuthClientInputSchema,
} from "../schema/oauth-client.schema";
import * as OAuthClientService from "../service/oauth-client.service";

export const getOAuthConnectionsFn = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => OAuthClientService.listOAuthConnections(context));

export const renameOAuthClientFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(RenameOAuthClientInputSchema)
  .handler(({ context, data }) =>
    OAuthClientService.renameOAuthClient(context, data),
  );

export const deleteOAuthConnectionFn = createServerFn({
  method: "POST",
})
  .middleware([superAdminMiddleware])
  .inputValidator(DeleteOAuthConnectionInputSchema)
  .handler(({ context, data }) =>
    OAuthClientService.deleteOAuthConnection(context, data.consentId),
  );
