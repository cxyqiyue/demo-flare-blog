import { ClientOnly } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { isFlare, isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSecondaryConfirm?: () => void;
  title: string;
  message: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  secondaryConfirmLabel?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

const ConfirmationModalInternal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onSecondaryConfirm,
  title,
  message,
  children,
  confirmLabel = m.common_confirm(),
  secondaryConfirmLabel,
  isDanger = false,
  isLoading = false,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isFlare || !isOpen) return;
    const previousFocus = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [isOpen]);

  if (isFlare) {
    if (!isOpen) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === event.currentTarget && !isLoading) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={isLoading}
          tabIndex={-1}
          className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl outline-none sm:p-6"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !isLoading) {
              event.stopPropagation();
              onClose();
            }
            if (event.key !== "Tab") return;
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
              ),
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
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              aria-label={m.common_close()}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X size={20} />
            </button>
          </div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
            {message}
          </p>
          {children}
          {isDanger ? (
            <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
              {m.common_irreversible()}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              {m.common_cancel()}
            </button>
            {onSecondaryConfirm && secondaryConfirmLabel ? (
              <button
                type="button"
                disabled={isLoading}
                onClick={onSecondaryConfirm}
                className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-50"
              >
                {secondaryConfirmLabel}
              </button>
            ) : null}
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 ${isDanger ? "bg-destructive" : "bg-primary"}`}
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : null}
              {isLoading ? m.common_processing() : confirmLabel}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className={
          isFuwari
            ? "absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/50"
            : "absolute inset-0 bg-background/90 backdrop-blur-sm"
        }
        onClick={isLoading ? undefined : () => onClose()}
      />

      {/* Modal Content */}
      <div
        className={`
          relative w-full max-w-md
          ${
            isFuwari
              ? "fuwari-card-base p-6 md:p-7 flex flex-col gap-4"
              : "bg-background border border-border/30 flex flex-col"
          }
          transform transition-all duration-300
          ${isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
        `}
      >
        {/* Header */}
        <div
          className={
            isFuwari
              ? "flex items-start justify-between gap-4"
              : "px-6 pt-8 pb-4 flex items-start justify-between"
          }
        >
          <div className="space-y-1.5">
            {isFuwari ? (
              <p
                className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                  isDanger ? "text-destructive" : "fuwari-text-30"
                }`}
              >
                {isDanger
                  ? m.common_modal_state_danger()
                  : m.common_modal_state_confirm()}
              </p>
            ) : (
              <p
                className={`text-xs font-mono uppercase tracking-widest ${
                  isDanger ? "text-destructive" : "text-muted-foreground/60"
                }`}
              >
                [
                {isDanger
                  ? ` ${m.common_modal_state_danger()} `
                  : ` ${m.common_modal_state_confirm()} `}
                ]
              </p>
            )}
            <h2
              className={
                isFuwari
                  ? "text-xl font-bold fuwari-text-90 break-words"
                  : "text-2xl font-serif font-medium text-foreground"
              }
            >
              {title}
            </h2>
          </div>
          <button
            onClick={() => onClose()}
            disabled={isLoading}
            className={
              isFuwari
                ? "shrink-0 p-1 -mr-1 -mt-1 fuwari-text-50 hover:text-(--fuwari-primary) transition-colors disabled:opacity-50"
                : "p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
            }
            aria-label={m.common_close()}
          >
            <X size={isFuwari ? 20 : 16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className={isFuwari ? "" : "px-6 pb-6"}>
          <p
            className={
              isFuwari
                ? "text-sm fuwari-text-50 leading-relaxed"
                : "text-base text-muted-foreground/80 leading-relaxed font-light"
            }
          >
            {message}
          </p>
          {children}

          {isDanger && (
            <div
              className={
                isFuwari
                  ? "mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive"
                  : "mt-6 p-3 border-l-2 border-destructive/50 text-[11px] font-mono uppercase tracking-widest text-destructive/70"
              }
            >
              {m.common_irreversible()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={
            isFuwari
              ? "flex items-center justify-end gap-2.5 pt-1"
              : "px-6 pb-6 flex justify-end gap-3"
          }
        >
          <button
            onClick={() => onClose()}
            disabled={isLoading}
            className={
              isFuwari
                ? "fuwari-btn-regular rounded-xl h-10 px-4 text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50"
                : "px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
            }
          >
            {m.common_cancel()}
          </button>
          {onSecondaryConfirm && secondaryConfirmLabel && (
            <button
              onClick={() => onSecondaryConfirm()}
              disabled={isLoading}
              className={
                isFuwari
                  ? "fuwari-btn-regular rounded-xl h-10 px-4 text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50"
                  : "px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
              }
            >
              {secondaryConfirmLabel}
            </button>
          )}
          <button
            onClick={() => onConfirm()}
            disabled={isLoading}
            className={`
              ${
                isFuwari
                  ? isDanger
                    ? "bg-destructive text-white rounded-xl shadow-sm"
                    : "fuwari-btn-primary rounded-xl shadow-sm"
                  : isDanger
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-foreground text-background"
              }
              ${
                isFuwari
                  ? "flex items-center justify-center gap-2 h-10 px-5 text-sm font-bold active:scale-[0.98] transition-all"
                  : "flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-mono uppercase tracking-widest transition-all"
              }
              hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            {isLoading && <Loader2 size={12} className="animate-spin" />}
            <span>{isLoading ? m.common_processing() : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default function ConfirmationModal(props: ConfirmationModalProps) {
  return (
    <ClientOnly>
      <ConfirmationModalInternal {...props} />
    </ClientOnly>
  );
}
