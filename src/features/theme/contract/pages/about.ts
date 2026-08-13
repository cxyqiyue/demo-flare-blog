import type { PostWithToc } from "@/features/posts/schema/posts.schema";

export interface AboutPageProps {
  /** 关于文章（slug=about）。管理员尚未创建时为 null */
  post: Exclude<PostWithToc, null> | null;
  /** 当前浏览者是否为管理员（用于空状态下展示创建入口） */
  isAdmin: boolean;
  /** 管理员点击"创建/编辑"时触发页面内编辑（不跳转后台） */
  onStartEdit?: () => void;
}
