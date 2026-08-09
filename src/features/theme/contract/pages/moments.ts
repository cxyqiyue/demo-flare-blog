import type { JSONContent } from "@tiptap/react";
import type { MomentWithStats } from "@/features/moments/moments.schema";

export interface MomentsPageProps {
  /** 动态列表（最新在前） */
  moments: Array<MomentWithStats>;
  /** 当前浏览者是否为管理员（用于展示发布/删除入口） */
  isAdmin: boolean;
  /** 当前登录用户 id */
  currentUserId?: string | null;
  /** 点赞 / 取消点赞，返回是否成功 */
  onToggleLike: (momentId: number) => Promise<boolean>;
  /** 发布动态（管理员），返回是否成功 */
  onCreateMoment: (content: JSONContent, images: string[]) => Promise<boolean>;
  /** 删除动态（管理员），返回是否成功 */
  onDeleteMoment: (id: number) => Promise<boolean>;
}
