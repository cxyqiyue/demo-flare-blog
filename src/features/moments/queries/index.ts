import { queryOptions } from "@tanstack/react-query";
import { getPublicMomentsPageFn } from "../api/moments.user.api";

export const MOMENTS_KEYS = {
  all: ["moments"] as const,
  list: ["moments", "list"] as const,
  publicPage: ["moments", "public-page"] as const,
};

export function publicMomentsPageQuery(filters: {
  offset: number;
  limit: number;
}) {
  return queryOptions({
    queryKey: [...MOMENTS_KEYS.publicPage, filters.offset, filters.limit],
    queryFn: () => getPublicMomentsPageFn({ data: filters }),
  });
}
