import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ClientOnly } from "@tanstack/react-router";
import { FileUp, Loader2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdminNavigation } from "@/features/navigation/hooks/use-navigation";
import type { ImportBookmarksFormValues } from "@/features/navigation/navigation.schema";
import { importBookmarksInputSchema } from "@/features/navigation/navigation.schema";
import { m } from "@/paraglide/messages";

interface ParsedBookmark {
  name: string;
  url: string;
  folderPath: string[];
}

function parseBookmarkHtml(html: string): ParsedBookmark[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bookmarks: ParsedBookmark[] = [];
  const stack: string[] = [];

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "h3" || tag === "h4" || tag === "dt") {
        if (tag === "h3" || tag === "h4") {
          stack.push((child.textContent ?? "").trim());
        } else {
          const anchor = child.querySelector("a");
          if (anchor) {
            const href = anchor.getAttribute("href");
            if (href) {
              bookmarks.push({
                name: (anchor.textContent ?? "").trim(),
                url: href,
                folderPath: [...stack],
              });
            }
          }
        }
        walk(child);
      }
    }
  };

  walk(doc.body ?? doc);
  return bookmarks;
}

interface ImportBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportBookmarkModalInternal = ({
  isOpen,
  onClose,
}: ImportBookmarkModalProps) => {
  const { importBookmarks, isImporting } = useAdminNavigation();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBookmark[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const form = useForm<ImportBookmarksFormValues>({
    resolver: standardSchemaResolver(importBookmarksInputSchema(m)),
    defaultValues: { replace: false, items: [] },
  });
  const { register, handleSubmit, reset } = form;

  const handleFile = async (file: File | null) => {
    if (!file) {
      setFileName(null);
      setParsed([]);
      setParseError(null);
      return;
    }
    setFileName(file.name);
    setParseError(null);
    const text = await file.text();
    const items = parseBookmarkHtml(text);
    if (items.length === 0) {
      setParseError(m.navigation_admin_import_bad_file());
      setParsed([]);
    } else {
      setParsed(items);
    }
  };

  const handleConfirm = async ({ replace }: ImportBookmarksFormValues) => {
    if (parsed.length === 0) {
      toast.error(m.navigation_admin_import_no_file());
      return;
    }
    const grouped = new Map<string | null, { name: string; url: string }[]>();
    for (const bookmark of parsed) {
      const folderName = bookmark.folderPath.at(-1) ?? null;
      const list = grouped.get(folderName) ?? [];
      list.push({ name: bookmark.name, url: bookmark.url });
      grouped.set(folderName, list);
    }
    const items = Array.from(grouped.entries()).map(
      ([folderName, bookmarks]) => ({
        ...(folderName ? { folderName } : {}),
        bookmarks,
      }),
    );

    const result = await importBookmarks({ data: { items, replace } });
    if (result.data) {
      reset();
      setFileName(null);
      setParsed([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !isImporting && onClose()}
      />
      <div className="relative bg-background border border-border/30 p-6 md:p-8 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 shadow-lg">
        <button
          onClick={() => !isImporting && onClose()}
          className="absolute right-4 top-4 text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
        <h3 className="text-xl font-serif font-medium mb-2">
          {m.navigation_admin_import_title()}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {m.navigation_admin_import_desc()}
        </p>

        <form onSubmit={handleSubmit(handleConfirm)} className="space-y-5">
          {/* File select */}
          <label className="flex items-center gap-3 border border-dashed border-border/50 px-4 py-4 cursor-pointer hover:border-foreground/40 transition-colors">
            <FileUp size={18} className="text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="block text-sm truncate">
                {fileName ?? m.navigation_admin_import_select_file()}
              </span>
            </div>
            <input
              type="file"
              accept="text/html,.html"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {parseError && <p className="text-xs text-red-500">! {parseError}</p>}

          {parsed.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {m.navigation_admin_import_preview({ count: parsed.length })}
            </p>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox {...register("replace")} />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {m.navigation_admin_import_replace()}
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => !isImporting && onClose()}
              className="font-mono text-xs uppercase tracking-widest rounded-none"
            >
              {m.friend_links_batch_cancel()}
            </Button>
            <Button
              type="submit"
              disabled={isImporting}
              className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-widest"
            >
              {isImporting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                m.navigation_admin_import_btn()
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export function ImportBookmarkModal(props: ImportBookmarkModalProps) {
  return (
    <ClientOnly>
      <ImportBookmarkModalInternal {...props} />
    </ClientOnly>
  );
}
