import { queryOptions } from "@tanstack/react-query";
import { getAllMomentsFn } from "../api/moments.admin.api";
import { getPublicMomentsFn } from "../api/moments.user.api";

export const MOMENTS_KEYS = {
  all: ["moments"] as const,
  public: ["moments", "public"] as const,
  admin: ["moments", "admin"] as const,
};

export function publicMomentsQuery(
  options: { offset?: number; limit?: number } = {},
) {
  return queryOptions({
    queryKey: [...MOMENTS_KEYS.public, options],
    queryFn: () => getPublicMomentsFn({ data: options }),
  });
}

export function allMomentsQuery(
  options: { offset?: number; limit?: number } = {},
) {
  return queryOptions({
    queryKey: [...MOMENTS_KEYS.admin, options],
    queryFn: () => getAllMomentsFn({ data: options }),
  });
}
