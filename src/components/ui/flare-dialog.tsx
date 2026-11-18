import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface FlareDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  busy?: boolean;
  className?: string;
  children?: ReactNode;
}

export function FlareDialog({
  open,
  onClose,
  title,
  description,
  busy = false,
  className,
  children,
}: FlareDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        !element.contains(panelRef.current) &&
        !element.inert,
    );
    for (const sibling of siblings) sibling.inert = true;
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      for (const sibling of siblings) sibling.inert = false;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        data-flare-dialog="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy}
        tabIndex={-1}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card font-sans text-foreground shadow-2xl outline-none",
          className,
        )}
        onKeyDown={(event) => {
          const activePopover = document.activeElement?.closest(
            "[data-flare-popover]",
          );
          if (activePopover) return;
          if (event.key === "Escape" && !busyRef.current) {
            event.preventDefault();
            event.stopPropagation();
            closeRef.current();
          }
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
            ),
          ).filter(
            (element) =>
              element.getClientRects().length > 0 &&
              !element.closest("[inert]"),
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === event.currentTarget)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === event.currentTarget)
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 p-4 sm:px-6 sm:py-5">
          <div className="min-w-0 space-y-2">
            <h2
              id={titleId}
              className="break-words text-xl font-semibold leading-7"
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="text-sm leading-6 text-muted-foreground"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={m.common_close()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
