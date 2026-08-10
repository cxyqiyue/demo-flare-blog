import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "@/lib/middlewares";
import {
  BanUserInputSchema,
  GetUsersInputSchema,
  SetUserRoleInputSchema,
  UnbanUserInputSchema,
} from "../users.schema";
import * as UserService from "../users.service";

export const listUsersFn = createServerFn({
  method: "GET",
})
  .middleware([adminMiddleware])
  .inputValidator(GetUsersInputSchema)
  .handler(
    async ({ data, context }) => await UserService.listUsers(context, data),
  );

export const setUserRoleFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(SetUserRoleInputSchema)
  .handler(
    async ({ data, context }) => await UserService.setUserRole(context, data),
  );

export const banUserFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(BanUserInputSchema)
  .handler(
    async ({ data, context }) => await UserService.banUser(context, data),
  );

export const unbanUserFn = createServerFn({
  method: "POST",
})
  .middleware([adminMiddleware])
  .inputValidator(UnbanUserInputSchema)
  .handler(
    async ({ data, context }) => await UserService.unbanUser(context, data),
  );
