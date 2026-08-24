export const ADMIN_ITEMS_PER_PAGE = 12;

export const CACHE_CONTROL = {
  public: {
    "Cache-Control": "public, max-age=0, must-revalidate",
    // 页面 HTML 只在边缘/Worker 缓存很短时间且不使用长 SWR 窗口：
    // 1) 避免发布后旧 HTML 长时间命中导致引用的新哈希资源 404；
    // 2) 未配置 Purge 凭证时，访客刷新最多约 1 分钟即可看到最新内容，
    //    配合数据层 generation 轮换，整体旧内容窗口收敛到 ~1-2 分钟。
    "CDN-Cache-Control": "public, s-maxage=60",
  },
  swr: {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "public, s-maxage=1, stale-while-revalidate=604800",
  },
  immutable: {
    "Cache-Control": "public, max-age=31536000, immutable",
    "CDN-Cache-Control": "public, max-age=31536000, immutable",
  },
  forbidden: {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "public, s-maxage=3600",
  },
  notFound: {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "public, s-maxage=10",
  },
  serverError: {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "public, s-maxage=10",
  },
  private: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "private, no-store",
  },
} as const;

export const ADMIN_STATS = {
  totalViews: 45231,
  etherStability: 89.4,
  systemHealth: "STABLE",
  pendingComments: 12,
  databaseSize: "1.2 GB",
};
