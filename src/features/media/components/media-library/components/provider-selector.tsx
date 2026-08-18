import { Check, ChevronDown, Cloud, Database, Globe, Upload } from "lucide-react";
import { useState } from "react";
import type { MediaProvider } from "@/features/media/media.schema";
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
};

export function ProviderSelector({
  providers,
  currentId,
  onSelect,
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const current = providers.find((p) => p.id === currentId);
  const Icon = current ? (PROVIDER_ICONS[current.type] ?? Upload) : Upload;

  if (providers.length <= 1) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 h-10 px-4 border border-border/30 bg-muted/10 hover:bg-muted/20 transition-all text-xs font-mono uppercase tracking-widest"
      >
        <Icon size={12} strokeWidth={1.5} className="text-muted-foreground" />
        <span className="text-foreground font-medium">
          {current?.name ?? "Select Provider"}
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "text-muted-foreground transition-transform",
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
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] border border-border/30 bg-background shadow-md">
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
                    "flex items-center gap-3 w-full px-4 py-3 text-left text-xs font-mono transition-all",
                    isActive
                      ? "bg-foreground text-background"
                      : "hover:bg-muted/20 text-foreground",
                  )}
                >
                  <PIcon size={12} strokeWidth={1.5} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <div className="flex items-center gap-2">
                    {p.canList && (
                      <span className="text-[9px] uppercase tracking-wider opacity-50">CRUD</span>
                    )}
                    {p.canUpload && !p.canList && (
                      <Upload size={8} className="opacity-50" />
                    )}
                    {isActive && <Check size={12} />}
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
