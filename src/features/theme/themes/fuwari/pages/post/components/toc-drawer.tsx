import { List, X } from "lucide-react";
import { useState } from "react";
import type { TableOfContentsItem } from "@/features/posts/utils/toc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import TableOfContents from "./table-of-contents";

/**
 * 小屏（<2xl）的文章目录：右上角浮动按钮 + 右侧滑出抽屉。
 * 桌面（>=2xl）仍使用页内右侧固定大纲，此按钮隐藏。
 */
export function TocDrawer({
  headers,
}: {
  headers: Array<TableOfContentsItem>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (headers.length === 0) return null;

  const close = () => setIsOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={m.post_toc()}
        title={m.post_toc()}
        className="fixed bottom-56 right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full fuwari-card-base shadow-md 2xl:hidden transition-all hover:bg-(--fuwari-btn-plain-bg-hover) active:scale-90"
      >
        <List className="w-6 h-6 text-(--fuwari-primary)" strokeWidth={2.5} />
      </button>

      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-49 bg-black/20 backdrop-blur-sm transition-opacity duration-300 2xl:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={close}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={m.post_toc()}
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] fuwari-card-base overflow-hidden transition-transform duration-300 ease-out 2xl:hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-14 px-5 border-b border-black/5 dark:border-white/10 shrink-0">
          <span className="text-sm font-bold fuwari-text-90">
            {m.post_toc()}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label={m.post_toc_close()}
            className="p-1.5 -mr-1.5 rounded-full fuwari-text-50 hover:fuwari-text-75 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-3 h-[calc(100%-3.5rem)]">
          <TableOfContents
            headers={headers}
            forceVisible
            tocHeightClass="h-full"
            onNavigate={close}
          />
        </div>
      </div>
    </>
  );
}
