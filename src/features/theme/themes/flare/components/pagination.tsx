import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useState } from "react";
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
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (total <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= totalPages)
      onPageChange(parsed);
    setIsEditing(false);
  };
  const controlClass =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-(--flare-surface) px-3 text-sm font-semibold text-foreground shadow-(--flare-shadow-sm) transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4";

  return (
    <nav
      className="flare-surface flex flex-wrap items-center justify-center gap-2 p-3 sm:gap-3 sm:p-4"
      aria-label={m.pagination_page({ page, pages: totalPages })}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrevPage}
        className={controlClass}
      >
        <ChevronLeft size={16} />
        <span>{m.pagination_prev()}</span>
      </button>
      <div className="hidden items-center gap-1.5 sm:flex">
        {pages.map((value, index) => (
          <span key={value} className="contents">
            {index > 0 && value - pages[index - 1] > 1 ? (
              <MoreHorizontal
                size={16}
                className="mx-1 text-muted-foreground"
                aria-hidden="true"
              />
            ) : null}
            <button
              type="button"
              aria-label={m.pagination_page({ page: value, pages: totalPages })}
              aria-current={page === value ? "page" : undefined}
              onClick={() => onPageChange(value)}
              className={`flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-semibold tabular-nums transition-colors ${page === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {value}
            </button>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        className={controlClass}
      >
        <span>{m.pagination_next()}</span>
        <ChevronRight size={16} />
      </button>
      <div className="flex w-full items-center justify-center gap-2 text-sm tabular-nums text-muted-foreground sm:ml-1 sm:w-auto">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPages}
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsEditing(false);
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
              }}
              className="h-10 w-16 rounded-lg border border-primary bg-background px-2 text-center text-base text-foreground"
              aria-label={m.pagination_page_input()}
            />
            <button
              type="button"
              onClick={commit}
              className="min-h-10 rounded-lg px-2 text-sm font-medium text-primary"
            >
              {m.pagination_jump()}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(page));
              setIsEditing(true);
            }}
            className="min-h-10 rounded-lg px-3 transition-colors hover:bg-muted hover:text-foreground"
            title={m.pagination_page_input_hint({ pages: totalPages })}
          >
            {page} / {totalPages}
          </button>
        )}
      </div>
    </nav>
  );
}
