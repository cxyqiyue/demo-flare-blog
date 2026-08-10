import { queryOptions } from "@tanstack/react-query";
import { listUsersFn } from "../api/users.admin.api";
import type { GetUsersInput } from "../users.schema";

export const USERS_KEYS = {
  all: ["users"] as const,
  admin: ["users", "admin"] as const,
};

export function adminUsersQuery(options: GetUsersInput = {}) {
  return queryOptions({
    queryKey: [...USERS_KEYS.admin, options],
    queryFn: () => listUsersFn({ data: options }),
  });
}
