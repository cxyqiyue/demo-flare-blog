import type { PostItem } from "@/features/posts/schema/posts.schema";

export interface HomePageProps {
  /** 当前页的文章列表（offset 分页，按发布时间倒序，包含置顶，置顶仅展示徽标） */
  posts: Array<PostItem>;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 全部已发布文章总数 */
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}
