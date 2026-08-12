import { CheckSquare, FileText, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

interface BatchActionBarProps {
  selectedCount: number;
  isPending: boolean;
  onPublish: () => void;
  onDraft: () => void;
  onClear: () => void;
}

export function BatchActionBar({
  selectedCount,
  isPending,
  onPublish,
  onDraft,
  onClear,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border border-border/40 bg-muted/20 backdrop-blur-sm sticky top-0 z-20 animate-in fade-in slide-in-from-top-2 duration-300 fill-mode-both">
      <div className="flex items-center gap-2 min-w-0">
        <CheckSquare size={14} strokeWidth={1.5} className="text-foreground" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-foreground whitespace-nowrap">
          {m.admin_posts_selected_count({ count: String(selectedCount) })}
        </span>
      </div>

      <div className="hidden sm:block h-4 w-px bg-border/40" />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={onPublish}
          className="h-8 px-3 gap-1.5 text-[11px] font-medium rounded-none bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          <Save size={13} strokeWidth={1.5} />
          {m.admin_posts_batch_publish()}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={onDraft}
          className="h-8 px-3 gap-1.5 text-[11px] font-medium rounded-none border-border/40 hover:border-foreground hover:text-foreground disabled:opacity-50"
        >
          <FileText size={13} strokeWidth={1.5} />
          {m.admin_posts_batch_draft()}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={onClear}
          className="h-8 px-2 gap-1 text-[11px] font-medium rounded-none text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          <X size={13} strokeWidth={1.5} />
          {m.admin_posts_batch_clear()}
        </Button>
      </div>
    </div>
  );
}
