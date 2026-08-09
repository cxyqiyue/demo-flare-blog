import type { PostWithToc } from "@/features/posts/schema/posts.schema";

export interface AboutPageProps {
  /** 关于文章（slug=about）。管理员尚未创建时为 null */
  post: Exclude<PostWithToc, null> | null;
  /** 当前浏览者是否为管理员（用于空状态下展示创建入口） */
  isAdmin: boolean;
}
