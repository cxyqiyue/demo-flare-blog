import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { skillsAdminQueryOptions } from "@/features/skills/queries";
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
        className="flex w-full items-center justify-between gap-2 border border-input bg-transparent px-2 py-1.5 text-left text-sm shadow-sm transition-colors cursor-pointer hover:border-foreground/30"
      >
        <span className={cn("truncate", selected ? "text-foreground" : "text-muted-foreground/50")}>
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
            className="ml-1 rounded-full p-0.5 text-muted-foreground/60 hover:text-foreground"
          >
            <X size={10} />
          </span>
        ) : (
          <ChevronDown
            size={12}
            className="text-muted-foreground/60 transition-transform group-focus-within:rotate-180"
          />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="max-h-50 w-full overflow-y-auto p-1">
            <div
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span className="flex-1 truncate text-muted-foreground">
                {m.editor_skill_none()}
              </span>
              {!selected && <Check className="ml-auto h-4 w-4 opacity-50" />}
            </div>
            {skills.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {m.editor_skill_empty()}
              </p>
            )}
            {skills.map((skill) => {
              const isSelected = skill.id === value;
              return (
                <div
                  key={skill.id}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                    isSelected
                      ? "bg-accent/50 text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onClick={() => {
                    onChange(skill.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{skill.name}</span>
                  {isSelected && <Check className="ml-auto h-4 w-4 opacity-50" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
