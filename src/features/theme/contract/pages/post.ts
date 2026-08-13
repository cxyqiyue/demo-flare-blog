import type { PostWithToc } from "@/features/posts/schema/posts.schema";

export interface PostPageProps {
  post: Exclude<PostWithToc, null>;
  /** 隐藏管理员"编辑"链接（用于关于页等页面内编辑场景，不跳转后台） */
  hideAdminEdit?: boolean;
}
