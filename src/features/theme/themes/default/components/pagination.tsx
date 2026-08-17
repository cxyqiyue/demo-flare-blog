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

      <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap select-none">
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
            className="w-14 h-8 rounded border border-border bg-background text-center text-xs font-mono text-foreground tabular-nums outline-none focus:border-foreground/50 focus:ring-1 focus:ring-foreground/10"
            aria-label={m.pagination_page_input()}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="min-w-8 h-8 px-1.5 rounded text-xs font-mono font-semibold text-foreground hover:text-primary hover:bg-muted active:bg-muted/60 cursor-pointer transition-colors"
            title={m.pagination_page_input_hint({ pages: totalPages })}
          >
            {page}
          </button>
        )}

        <span className="shrink-0">
          <span className="opacity-50">/</span>
          &nbsp;{totalPages}
          {m.pagination_page_suffix() && (
            <>&nbsp;{m.pagination_page_suffix()}</>
          )}
        </span>
      </div>

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
