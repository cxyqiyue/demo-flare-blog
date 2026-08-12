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
      className="flex items-center justify-between gap-3 w-full"
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

      <div className="flex items-center gap-1.5 text-sm fuwari-text-50 tabular-nums whitespace-nowrap select-none">
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
            className="w-14 h-9 rounded-lg text-center text-sm fuwari-text-90 tabular-nums bg-(--fuwari-input-bg) border border-(--fuwari-input-border) outline-none transition-colors focus:border-(--fuwari-primary)"
            aria-label={m.pagination_page_input()}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="min-w-10 h-9 px-1.5 rounded-lg text-sm font-semibold fuwari-text-90 hover:text-(--fuwari-primary) hover:bg-(--fuwari-btn-plain-bg-hover) active:bg-(--fuwari-btn-plain-bg-active) cursor-pointer transition-all"
            title={m.pagination_page_input_hint({ pages: totalPages })}
          >
            {page}
          </button>
        )}

        <span className="shrink-0">
          <span className="opacity-60">/</span>
          &nbsp;{totalPages}
          {m.pagination_page_suffix() && <>&nbsp;{m.pagination_page_suffix()}</>}
        </span>
      </div>

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
