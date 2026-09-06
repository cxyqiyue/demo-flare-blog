import {
  Brain,
  Check,
  ChevronDown,
  Cloud,
  Database,
  FolderGit2,
  Globe,
  MessageSquare,
  Send,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type { MediaProvider } from "@/features/media/media.schema";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

interface ProviderSelectorProps {
  providers: MediaProvider[];
  currentId: string;
  onSelect: (id: string) => void;
}

const PROVIDER_ICONS: Record<string, typeof Cloud> = {
  r2: Cloud,
  s3: Database,
  "api-key": Globe,
  telegram: Send,
  discord: MessageSquare,
  huggingface: Brain,
  webdav: FolderGit2,
};

export function ProviderSelector({
  providers,
  currentId,
  onSelect,
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const current = providers.find((p) => p.id === currentId);
  const Icon = current ? (PROVIDER_ICONS[current.type] ?? Upload) : Upload;

  if (providers.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 h-10 px-4 transition-all",
          isFuwari
            ? "fuwari-btn-regular rounded-xl hover:border-(--fuwari-primary)/50"
            : "border border-border/30 bg-muted/10 hover:bg-muted/20 text-xs font-mono uppercase tracking-widest",
        )}
      >
        <Icon
          size={12}
          strokeWidth={1.5}
          className={isFuwari ? "fuwari-text-50" : "text-muted-foreground"}
        />
        <span
          className={cn(
            "font-medium",
            isFuwari ? "fuwari-text-90" : "text-foreground",
          )}
        >
          {current?.name ?? "Select Provider"}
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "transition-transform",
            isFuwari ? "fuwari-text-30" : "text-muted-foreground",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={
              isFuwari
                ? "fuwari-card-base absolute top-full left-0 mt-1 z-50 min-w-[200px] p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95"
                : "absolute top-full left-0 mt-1 z-50 min-w-[200px] border border-border/30 bg-background shadow-md"
            }
          >
            {providers.map((p) => {
              const PIcon = PROVIDER_ICONS[p.type] ?? Upload;
              const isActive = p.id === currentId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 text-left transition-all",
                    isFuwari ? "rounded-lg text-sm" : "text-xs font-mono",
                    isFuwari
                      ? isActive
                        ? "bg-(--fuwari-primary)/10 text-(--fuwari-primary) font-semibold"
                        : "fuwari-text-75 hover:bg-(--fuwari-btn-plain-bg-hover) hover:text-(--fuwari-primary)"
                      : isActive
                        ? "bg-foreground text-background"
                        : "hover:bg-muted/20 text-foreground",
                  )}
                >
                  <PIcon
                    size={12}
                    strokeWidth={1.5}
                    className={
                      isActive
                        ? undefined
                        : isFuwari
                          ? "fuwari-text-30"
                          : undefined
                    }
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  <div className="flex items-center gap-2">
                    {p.canList && (
                      <span
                        className={
                          isFuwari
                            ? "text-[10px] fuwari-text-30"
                            : "text-[9px] uppercase tracking-wider opacity-50"
                        }
                      >
                        CRUD
                      </span>
                    )}
                    {p.canUpload && !p.canList && (
                      <Upload size={8} className="opacity-50" />
                    )}
                    {isActive && (
                      <Check
                        size={12}
                        className={
                          isFuwari ? "text-(--fuwari-primary)" : undefined
                        }
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
