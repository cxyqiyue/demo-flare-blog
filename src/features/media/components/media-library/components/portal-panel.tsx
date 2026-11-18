import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isFlare } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

interface PortalPanelProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  minWidth?: number;
  align?: "start" | "end";
}

interface PanelPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Renders a panel via a portal into document.body with `position: fixed`,
 * anchored to the given trigger element. Unlike an `absolute` child, a fixed,
 * portaled panel is never clipped by an ancestor's `overflow`. Repositions on
 * resize/scroll/own-size change and flips upward when it would overflow the
 * viewport bottom.
 */
export function PortalPanel({
  triggerRef,
  onClose,
  className,
  children,
  minWidth = 200,
  align = "start",
}: PortalPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const desiredWidth = Math.max(minWidth, triggerRect.width, panelRect.width);
    const width = isFlare
      ? Math.min(desiredWidth, window.innerWidth - 16)
      : desiredWidth;

    const gap = 6;
    const margin = 8;
    let top = triggerRect.bottom + gap;
    if (top + panelRect.height > window.innerHeight - margin) {
      top = Math.max(margin, triggerRect.top - panelRect.height - gap);
    }
    let left = align === "end" ? triggerRect.right - width : triggerRect.left;
    left = Math.min(
      Math.max(margin, left),
      Math.max(margin, window.innerWidth - width - margin),
    );
    setPosition({ top, left, width });
  }, [align, minWidth, triggerRef]);

  useEffect(() => {
    const panel = panelRef.current;
    const previousFocus = isFlare ? document.activeElement : null;
    measure();

    if (isFlare)
      panel?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const onResize = () => measure();
    const onScroll = () => measure();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFlare || !panel || !panel.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        if (triggerRef.current?.isConnected) triggerRef.current.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKeyDown);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && panel) {
      observer = new ResizeObserver(() => measure());
      observer.observe(panel);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyDown);
      observer?.disconnect();
      if (
        isFlare &&
        !triggerRef.current?.isConnected &&
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      )
        previousFocus.focus();
    };
  }, [measure, onClose]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[120]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role={isFlare ? "group" : "listbox"}
        data-flare-popover={isFlare ? "true" : undefined}
        className={cn("fixed z-[120]", !position && "invisible", className)}
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          width: position?.width ?? "auto",
          maxHeight: isFlare ? "calc(100dvh - 16px)" : undefined,
          overflowY: isFlare ? "auto" : undefined,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
