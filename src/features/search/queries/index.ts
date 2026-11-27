import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getIndexVersionFn } from "../api/search.api";

// Bust browser responses cached under the old immutable index-version protocol.
const SEARCH_ACCESS_VERSION = "public-v2";

export const SEARCH_KEYS = {
  all: ["search"] as const,

  // Leaf keys (static arrays - no child queries)
  meta: ["search", "meta"] as const,

  // Child keys (functions for specific queries)
  results: (query: string, version: string) =>
    ["search", "results", SEARCH_ACCESS_VERSION, query, version] as const,
};

export const searchMetaQuery = queryOptions({
  queryKey: SEARCH_KEYS.meta,
  queryFn: () => getIndexVersionFn(),
});

export const searchDocsQueryOptions = (query: string, version: string) =>
  queryOptions({
    queryKey: SEARCH_KEYS.results(query, version),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const res = await apiClient.search.$get(
        { query: { q: query, v: `${SEARCH_ACCESS_VERSION}:${version}` } },
        { init: { cache: "no-store" } },
      );
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
  });
