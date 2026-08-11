import type { PostItem } from "@/features/posts/schema/posts.schema";

export interface HomePageProps {
  /** 当前页的文章列表（offset 分页，不含置顶） */
  posts: Array<PostItem>;
  pinnedPosts?: Array<PostItem>;
  popularPosts?: Array<PostItem>;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 非置顶文章总数 */
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}
