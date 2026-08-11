import { ChevronLeft, ChevronRight } from "lucide-react";
import { m } from "@/paraglide/messages";

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  total,
  pageSize,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: PaginationProps) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav
      className="fuwari-onload-animation flex items-center justify-between gap-3 px-1 pt-4"
      aria-label={m.pagination_page({ page, pages: totalPages })}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrevPage}
        className="fuwari-btn-regular rounded-lg h-9 px-3 md:px-4 text-sm flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
      >
        <ChevronLeft size={16} />
        {m.pagination_prev()}
      </button>

      <span className="text-sm fuwari-text-50 tabular-nums whitespace-nowrap">
        {m.pagination_page({ page, pages: totalPages })}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        className="fuwari-btn-regular rounded-lg h-9 px-3 md:px-4 text-sm flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
      >
        {m.pagination_next()}
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
