import { queryOptions } from "@tanstack/react-query";
import { getPublicMomentsFn } from "../api/moments.user.api";

export const MOMENTS_KEYS = {
  all: ["moments"] as const,
  list: ["moments", "list"] as const,
};

export function publicMomentsQuery() {
  return queryOptions({
    queryKey: MOMENTS_KEYS.list,
    queryFn: () => getPublicMomentsFn(),
  });
}
