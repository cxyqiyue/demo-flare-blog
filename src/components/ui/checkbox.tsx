import { Check } from "lucide-react";
import * as React from "react";
import { isFlare, isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    onCheckedChange?: (checked: boolean) => void;
  }
>(({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
  if (isFlare)
    return (
      <input
        {...props}
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange?.(event);
          onCheckedChange?.(event.target.checked);
        }}
        className={cn(
          "h-5 w-5 shrink-0 cursor-pointer rounded border border-border accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
    );
  return (
    <div className="relative flex items-center">
      <input
        type="checkbox"
        className={
          isFlare
            ? "peer absolute inset-0 h-full w-full cursor-pointer opacity-0 z-10"
            : "peer absolute h-4 w-4 opacity-0 cursor-pointer z-10"
        }
        ref={ref}
        checked={checked}
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        {...props}
      />
      <div
        className={cn(
          isFlare
            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50"
            : isFuwari
              ? "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-colors"
              : "flex h-4 w-4 shrink-0 items-center justify-center border border-border/50 transition-colors",
          checked
            ? isFuwari
              ? "bg-(--fuwari-primary) border-(--fuwari-primary) text-white"
              : "bg-foreground border-foreground text-background"
            : isFlare
              ? "bg-card border-border"
              : "bg-transparent border-(--fuwari-input-border)",
          className,
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={2} />}
      </div>
    </div>
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
