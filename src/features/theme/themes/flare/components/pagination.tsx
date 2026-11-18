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
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const pages = Array.from(
    { length: Math.min(3, totalPages) },
    (_, i) => start + i,
  );
  const control =
    "grid size-11 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit";

  return (
    <nav
      className="flex items-center justify-center gap-1 sm:gap-2"
      aria-label={m.pagination_page({ page, pages: totalPages })}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrevPage}
        className={control}
        aria-label={m.pagination_prev()}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      {start > 1 && (
        <span aria-hidden="true" className="text-muted-foreground">
          …
        </span>
      )}
      {pages.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={m.pagination_page({ page: value, pages: totalPages })}
          aria-current={value === page ? "page" : undefined}
          onClick={() => onPageChange(value)}
          className={`${control} aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground`}
        >
          {value}
        </button>
      ))}
      {pages.at(-1) !== totalPages && (
        <span aria-hidden="true" className="text-muted-foreground">
          …
        </span>
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        className={control}
        aria-label={m.pagination_next()}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
