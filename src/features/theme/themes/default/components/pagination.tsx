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
      className="flex items-center justify-between gap-3 pt-8 border-t border-border/40"
      aria-label={m.pagination_page({ page, pages: totalPages })}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrevPage}
        className="inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:cursor-not-allowed whitespace-nowrap"
      >
        <ChevronLeft size={16} />
        {m.pagination_prev()}
      </button>

      <span className="text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap">
        {m.pagination_page({ page, pages: totalPages })}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        className="inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:cursor-not-allowed whitespace-nowrap"
      >
        {m.pagination_next()}
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
