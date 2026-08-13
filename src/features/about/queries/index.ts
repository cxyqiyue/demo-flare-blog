import { queryOptions } from "@tanstack/react-query";
import { getAboutArticleFn } from "../api/about.api";

export const ABOUT_KEYS = {
  all: ["about"] as const,
  article: ["about", "article"] as const,
};

export function aboutArticleQuery() {
  return queryOptions({
    queryKey: ABOUT_KEYS.article,
    queryFn: () => getAboutArticleFn(),
  });
}
