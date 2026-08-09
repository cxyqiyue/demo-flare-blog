import type { MomentWithAuthor } from "@/features/moments/moments.schema";

export interface MomentsPageProps {
  moments: Array<MomentWithAuthor>;
  total: number;
  hasNext: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}
