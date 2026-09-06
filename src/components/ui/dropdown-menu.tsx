import { ChevronDown } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { isFuwari } from "@/lib/theme-mode";

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownMenuProps {
  value: string;
  options: Array<DropdownOption>;
  onChange: (value: string) => void;
  className?: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  value,
  options,
  onChange,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={
          isFuwari
            ? "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium fuwari-text-75 hover:text-(--fuwari-primary) hover:bg-(--fuwari-btn-plain-bg-hover) active:bg-(--fuwari-btn-plain-bg-active) transition-colors"
            : "flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        }
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={
            isFuwari
              ? "fuwari-card-base absolute top-full left-0 mt-2 w-44 p-1.5 z-50 overflow-y-auto max-h-64 custom-scrollbar shadow-lg animate-in fade-in zoom-in-95 duration-200"
              : "absolute top-full left-0 mt-2 w-40 bg-popover border border-border/30 z-50 py-1 animate-in fade-in duration-200 max-h-64 overflow-y-auto custom-scrollbar rounded-sm shadow-xl"
          }
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={
                isFuwari
                  ? `w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      value === option.value
                        ? "text-(--fuwari-primary) bg-(--fuwari-btn-regular-bg) font-semibold"
                        : "fuwari-text-50 hover:text-(--fuwari-primary) hover:bg-(--fuwari-btn-plain-bg-hover)"
                    }`
                  : `w-full text-left px-3 py-2 text-xs font-mono transition-colors ${
                      value === option.value
                        ? "text-foreground bg-accent/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                    }`
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
