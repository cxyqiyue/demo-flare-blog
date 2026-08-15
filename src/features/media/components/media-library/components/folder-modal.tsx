import { ClientOnly } from "@tanstack/react-router";
import { FolderPlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";

interface FolderModalProps {
  isOpen: boolean;
  mode: "create" | "rename";
  initialName?: string;
  parentLabel?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isSubmitting?: boolean;
}

function FolderModalInternal({
  isOpen,
  mode,
  initialName = "",
  parentLabel,
  onClose,
  onSubmit,
  isSubmitting,
}: FolderModalProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  useEffect(() => {
    if (isOpen) {
      // Focus after the portal renders
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const submit = () => {
    const clean = name.replace(/^\/+|\/+$/g, "").trim();
    if (!clean || isSubmitting) return;
    onSubmit(clean);
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`
          relative w-full max-w-md bg-background border border-border/30
          transform transition-all duration-300
          ${isOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
        `}
      >
        <div className="px-6 pt-8 pb-4 flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [{" "}
              {mode === "create"
                ? m.media_folder_create_tag()
                : m.media_folder_rename_tag()}{" "}
              ]
            </p>
            <h2 className="text-2xl font-serif font-medium text-foreground">
              {mode === "create"
                ? m.media_folder_create_title()
                : m.media_folder_rename_title()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {parentLabel && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <FolderPlus size={12} />
              <span className="truncate">{parentLabel}</span>
            </div>
          )}
          <Input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={m.media_folder_name_placeholder()}
            className="h-10 bg-transparent border-border/30 hover:border-foreground/50 focus:border-foreground transition-all rounded-none font-sans text-sm shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="px-6 pb-6 pt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {m.media_folder_btn_cancel()}
          </button>
          <Button
            onClick={submit}
            disabled={isSubmitting || !name.trim()}
            className="h-10 px-6 text-[11px] uppercase tracking-[0.2em] font-medium rounded-none gap-2 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40"
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FolderPlus size={14} />
            )}
            {mode === "create"
              ? m.media_folder_create_btn()
              : m.media_folder_rename_btn()}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function FolderModal(props: FolderModalProps) {
  return (
    <ClientOnly>
      <FolderModalInternal {...props} />
    </ClientOnly>
  );
}
