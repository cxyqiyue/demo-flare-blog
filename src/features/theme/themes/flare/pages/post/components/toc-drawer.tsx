import { List, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TableOfContentsItem } from "@/features/posts/utils/toc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import TableOfContents from "./table-of-contents";

/**
 * 全尺寸文章目录抽屉，使用原生 dialog 管理焦点与 Escape 关闭。
 */
export function TocDrawer({
  headers,
}: {
  headers: Array<TableOfContentsItem>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) dialog.showModal();
    else dialog.close();
  }, [isOpen]);

  if (headers.length === 0) return null;

  const close = () => setIsOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={m.post_toc()}
        title={m.post_toc()}
        className="fixed bottom-24 right-6 md:right-8 z-40 flex items-center justify-center w-11 h-11 rounded-full flare-surface text-muted-foreground hover:text-foreground transition-all active:scale-95 min-[1100px]:hidden"
      >
        <List className="w-5 h-5" strokeWidth={1.5} />
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        aria-label={m.post_toc()}
        className={cn(
          "fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-background text-foreground border-l border-border p-0 overflow-hidden backdrop:bg-black/30 backdrop:backdrop-blur-sm",
        )}
      >
        <div className="flex items-center justify-between h-14 px-5 border-b border-border shrink-0">
          <span className="text-sm font-medium text-foreground">
            {m.post_toc()}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label={m.post_toc_close()}
            className="p-1.5 -mr-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-3 h-[calc(100%-3.5rem)]">
          <TableOfContents
            headers={headers}
            className="relative top-0 w-full max-h-[calc(100dvh-8.5rem)] animate-none"
            onNavigate={close}
          />
        </div>
      </dialog>
    </>
  );
}
