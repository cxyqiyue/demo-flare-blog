import type { ThemeConfig } from "@/features/theme/contract/config";

export const config: ThemeConfig = {
  home: {
    postsPerPage: 6,
    paginatePinned: true,
    popularPostsLimit: 5,
  },
  posts: {
    postsPerPage: 12,
  },
  post: {
    relatedPostsLimit: 3,
  },
};
