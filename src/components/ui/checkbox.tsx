import { Check } from "lucide-react";
import * as React from "react";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    onCheckedChange?: (checked: boolean) => void;
  }
>(({ className, checked, onCheckedChange, onChange, ...props }, ref) => (
  <div className="relative flex items-center">
    <input
      type="checkbox"
      className="peer absolute h-4 w-4 opacity-0 cursor-pointer z-10"
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
        isFuwari
          ? "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-colors"
          : "flex h-4 w-4 shrink-0 items-center justify-center border border-border/50 transition-colors",
        checked
          ? isFuwari
            ? "bg-(--fuwari-primary) border-(--fuwari-primary) text-white"
            : "bg-foreground border-foreground text-background"
          : "bg-transparent border-(--fuwari-input-border)",
        className,
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={2} />}
    </div>
  </div>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
