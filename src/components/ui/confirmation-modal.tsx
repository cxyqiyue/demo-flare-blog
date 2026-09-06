import { ClientOnly } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import type React from "react";
import { createPortal } from "react-dom";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSecondaryConfirm?: () => void;
  title: string;
  message: string;
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
  confirmLabel = m.common_confirm(),
  secondaryConfirmLabel,
  isDanger = false,
  isLoading = false,
}) => {
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
