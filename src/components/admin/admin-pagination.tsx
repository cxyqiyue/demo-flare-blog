import React from "react";
import { Button } from "@/components/ui/button";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  currentPageItemCount: number;
  onPageChange: (page: number) => void;
}

/** Generate smart page numbers with ellipsis */
function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  currentPageItemCount,
  onPageChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const endItem = Math.min(startItem + currentPageItemCount - 1, totalItems);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-8 pt-8 ${
        isFuwari ? "" : "border-t border-border/30 mt-8"
      }`}
    >
      <div
        className={
          isFuwari
            ? "text-sm fuwari-text-50"
            : "text-[10px] font-mono text-muted-foreground uppercase tracking-widest"
        }
      >
        {m.admin_pagination_info({
          startItem,
          endItem,
          totalItems,
        })}
      </div>

      <div className="flex items-center gap-2 max-w-full overflow-x-auto overscroll-x-contain">
        {/* Previous Button */}
        <Button
          variant={isFuwari ? "secondary" : "outline"}
          size={isFuwari ? "sm" : "icon"}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={
            isFuwari
              ? "h-9 px-3 active:scale-95 transition-all disabled:opacity-40"
              : "h-8 w-8 shrink-0 rounded-none border-border/30 hover:bg-foreground hover:text-background hover:border-foreground transition-all disabled:opacity-20"
          }
        >
          <span
            className={
              isFuwari ? "text-sm font-bold" : "font-mono text-xs font-bold"
            }
          >
            {"<"}
          </span>
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1.5 px-2 shrink-0">
          {pageNumbers.map((pageNumber, index) => (
            <React.Fragment key={index}>
              {pageNumber === "..." ? (
                <div
                  className={
                    isFuwari
                      ? "w-8 text-center text-sm fuwari-text-30"
                      : "w-8 text-center text-[10px] text-muted-foreground font-mono"
                  }
                >
                  ...
                </div>
              ) : (
                <Button
                  variant={isFuwari ? "ghost" : "ghost"}
                  size={isFuwari ? "sm" : "sm"}
                  onClick={() => onPageChange(pageNumber)}
                  className={
                    isFuwari
                      ? `h-9 min-w-10 px-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                          currentPage === pageNumber
                            ? "fuwari-text-90 bg-(--fuwari-btn-regular-bg) font-bold"
                            : "fuwari-text-50 hover:text-(--fuwari-primary) hover:bg-(--fuwari-btn-plain-bg-hover)"
                        }`
                      : `h-8 w-8 p-0 rounded-none font-mono text-xs transition-colors ${
                          currentPage === pageNumber
                            ? "bg-foreground text-background font-bold hover:bg-foreground hover:text-background"
                            : "text-muted-foreground hover:text-foreground hover:bg-transparent underline decoration-border/30 hover:decoration-foreground underline-offset-4"
                        }`
                  }
                >
                  {pageNumber}
                </Button>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Next Button */}
        <Button
          variant={isFuwari ? "secondary" : "outline"}
          size={isFuwari ? "sm" : "icon"}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={
            isFuwari
              ? "h-9 px-3 active:scale-95 transition-all disabled:opacity-40"
              : "h-8 w-8 shrink-0 rounded-none border-border/30 hover:bg-foreground hover:text-background hover:border-foreground transition-all disabled:opacity-20"
          }
        >
          <span
            className={
              isFuwari ? "text-sm font-bold" : "font-mono text-xs font-bold"
            }
          >
            {">"}
          </span>
        </Button>
      </div>
    </div>
  );
}
