import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const startEditing = () => {
    setDraft(String(page));
    setIsEditing(true);
  };

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= totalPages) {
      onPageChange(parsed);
    }
    setIsEditing(false);
  };

  return (
    <nav
      className="flex items-center justify-between gap-3 pt-6 mt-2 border-t border-border/40"
      aria-label={m.pagination_page({ page, pages: totalPages })}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrevPage}
        className="flare-chip disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={15} />
        {m.pagination_prev()}
      </button>

      <div className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums whitespace-nowrap select-none">
        <span className="shrink-0">{m.pagination_page_prefix()}</span>

        {isEditing ? (
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPages}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            onBlur={() => setIsEditing(false)}
            className="w-14 h-8 rounded-full border border-border/60 bg-background/70 text-center text-sm text-foreground tabular-nums outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/20"
            aria-label={m.pagination_page_input()}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="min-w-8 h-8 px-2 rounded-full border border-border/50 bg-background/50 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            title={m.pagination_page_input_hint({ pages: totalPages })}
          >
            {page}
          </button>
        )}

        <span className="shrink-0">
          <span className="opacity-50">/</span>
          &nbsp;{totalPages}
          {m.pagination_page_suffix() ? (
            <>&nbsp;{m.pagination_page_suffix()}</>
          ) : null}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNextPage}
        className="flare-chip disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {m.pagination_next()}
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}
