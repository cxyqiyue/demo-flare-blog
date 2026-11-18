import { useEffect, useRef } from "react";
import { isFlare } from "@/lib/theme-mode";

export function useFlarePanel(open: boolean, close: () => void) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!isFlare || !open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = 0;
    let attempts = 0;
    const focusPanel = () => {
      if (ref.current) ref.current.focus();
      else if (++attempts < 10) frame = requestAnimationFrame(focusPanel);
    };
    focusPanel();
    const keydown = (event: KeyboardEvent) => {
      const panel = ref.current;
      if (
        !panel ||
        panel.inert ||
        document.activeElement?.closest('[aria-modal="true"]') !== panel
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === panel)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);
  return ref;
}
