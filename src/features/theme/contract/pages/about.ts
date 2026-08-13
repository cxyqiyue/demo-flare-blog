import type { AboutArticle } from "@/features/about/about.schema";

export interface AboutPageProps {
  /** 关于页文章（独立于文章体系，全站仅一篇）。尚未创建时为 null */
  article: Exclude<AboutArticle, null> | null;
  /** 当前浏览者是否为管理员（用于展示创建/编辑入口） */
  isAdmin: boolean;
  /** 管理员点击"创建/编辑"时触发页面内编辑（不跳转后台） */
  onStartEdit?: () => void;
}
