import { queryOptions } from "@tanstack/react-query";
import { getNavigationPublicDataFn } from "../api/navigation.user.api";

export const NAVIGATION_KEYS = {
  all: ["navigation"] as const,
  publicData: ["navigation", "public"] as const,
  admin: ["navigation", "admin"] as const,
};

export function navigationPublicDataQuery() {
  return queryOptions({
    queryKey: NAVIGATION_KEYS.publicData,
    queryFn: () => getNavigationPublicDataFn(),
    staleTime: 5 * 60 * 1000,
  });
}
