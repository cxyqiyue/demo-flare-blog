import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { skillsAdminQueryOptions } from "@/features/skills/queries";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

interface SkillSelectorProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function SkillSelector({ value, onChange }: SkillSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: skills = [] } = useQuery(skillsAdminQueryOptions());

  const selected = skills.find((skill) => skill.id === value) ?? null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative group" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm transition-colors cursor-pointer",
          isFuwari
            ? "rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) px-3 py-2 hover:border-(--fuwari-primary)/50 focus:border-(--fuwari-primary)/50"
            : "border border-input bg-transparent shadow-sm hover:border-foreground/30",
        )}
      >
        <span
          className={cn(
            "truncate",
            selected
              ? isFuwari
                ? "fuwari-text-90"
                : "text-foreground"
              : isFuwari
                ? "fuwari-text-30"
                : "text-muted-foreground/50",
          )}
        >
          {selected ? selected.name : m.editor_skill_none()}
        </span>
        {selected ? (
          <span
            role="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(null);
            }}
            className={cn(
              "ml-1 rounded-full p-0.5",
              isFuwari
                ? "fuwari-text-30 hover:text-(--fuwari-primary)"
                : "text-muted-foreground/60 hover:text-foreground",
            )}
          >
            <X size={10} />
          </span>
        ) : (
          <ChevronDown
            size={12}
            className={cn(
              "transition-transform group-focus-within:rotate-180",
              isFuwari ? "fuwari-text-30" : "text-muted-foreground/60",
            )}
          />
        )}
      </button>

      {open && (
        <div
          className={
            isFuwari
              ? "fuwari-card-base absolute top-full left-0 z-50 mt-1 w-full p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95"
              : "absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          }
        >
          <div className="max-h-50 w-full overflow-y-auto p-1">
            <div
              className={cn(
                "relative flex cursor-pointer select-none items-center px-2 py-1.5 text-sm outline-none",
                isFuwari
                  ? "rounded-lg transition-colors fuwari-text-50 hover:bg-(--fuwari-btn-plain-bg-hover) hover:text-(--fuwari-primary)"
                  : "rounded-sm hover:bg-accent hover:text-accent-foreground",
              )}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span
                className={cn(
                  "flex-1 truncate",
                  isFuwari ? "" : "text-muted-foreground",
                )}
              >
                {m.editor_skill_none()}
              </span>
              {!selected && (
                <Check
                  className={cn(
                    "ml-auto h-4 w-4 opacity-50",
                    isFuwari && "text-(--fuwari-primary)",
                  )}
                />
              )}
            </div>
            {skills.length === 0 && (
              <p
                className={cn(
                  "px-2 py-2 text-xs",
                  isFuwari ? "fuwari-text-50" : "text-muted-foreground",
                )}
              >
                {m.editor_skill_empty()}
              </p>
            )}
            {skills.map((skill) => {
              const isSelected = skill.id === value;
              return (
                <div
                  key={skill.id}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center px-2 py-1.5 text-sm outline-none transition-colors",
                    isSelected
                      ? isFuwari
                        ? "rounded-lg font-semibold bg-(--fuwari-primary)/10 text-(--fuwari-primary)"
                        : "rounded-sm bg-accent/50 text-accent-foreground"
                      : isFuwari
                        ? "rounded-lg fuwari-text-75 hover:bg-(--fuwari-btn-plain-bg-hover) hover:text-(--fuwari-primary)"
                        : "rounded-sm hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => {
                    onChange(skill.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{skill.name}</span>
                  {isSelected && (
                    <Check className="ml-auto h-4 w-4 opacity-50" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
