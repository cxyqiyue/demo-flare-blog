import type * as React from "react";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

function Input({
  ref,
  className,
  type,
  ...props
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      type={type}
      className={cn(
        isFuwari
          ? "flex h-9 w-full rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) px-3.5 py-1 text-sm fuwari-text-90 transition-all placeholder:text-black/35 selection:bg-(--fuwari-selection-bg) dark:placeholder:text-white/35 focus-visible:outline-none focus-visible:border-(--fuwari-primary)/50 focus-visible:bg-(--fuwari-primary)/5 disabled:cursor-not-allowed disabled:opacity-50 read-only:opacity-70 read-only:cursor-default"
          : "flex h-9 w-full rounded-none border-b border-input bg-transparent px-0 py-1 text-sm transition-all placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:border-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 read-only:opacity-70 read-only:cursor-default read-only:bg-muted/20",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}
Input.displayName = "Input";

export { Input };
