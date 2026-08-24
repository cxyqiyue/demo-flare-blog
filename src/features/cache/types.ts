export type CacheKey =
  | string
  | ReadonlyArray<string | number | boolean | null | undefined>;

export const CACHE_NAMESPACES = {
  POSTS_LIST: "posts:list",
  POSTS_DETAIL: "posts:detail",
  TAGS_LIST: "tags:list",
  CONFIG_SYSTEM: "config:system",
  FRIEND_LINKS_LIST: "friend-links:list",
  MOMENTS_LIST: "moments:list",
  MOMENTS_PAGE: "moments:page",
  NAVIGATION_DATA: "navigation:data",
} as const;

export type CacheNamespace =
  (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES];
