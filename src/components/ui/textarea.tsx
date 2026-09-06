import type * as React from "react";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

function Textarea({
  ref,
  className,
  ...props
}: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      className={cn(
        isFuwari
          ? "flex min-h-20 w-full rounded-xl border border-(--fuwari-input-border) bg-(--fuwari-input-bg) px-3.5 py-2 text-sm fuwari-text-90 transition-all placeholder:text-black/35 dark:placeholder:text-white/35 focus-visible:outline-none focus-visible:border-(--fuwari-primary)/50 focus-visible:bg-(--fuwari-primary)/5 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          : "flex min-h-20 w-full rounded-none border-b border-input bg-transparent px-0 py-2 text-sm transition-all placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:border-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}
Textarea.displayName = "Textarea";

export { Textarea };
