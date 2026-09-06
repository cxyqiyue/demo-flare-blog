import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  isFuwari
    ? "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none"
    : "inline-flex items-center border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: isFuwari
          ? "bg-(--fuwari-btn-regular-bg) fuwari-text-75 border border-(--fuwari-input-border)"
          : "border-foreground/20 bg-foreground text-background",
        secondary: isFuwari
          ? "bg-(--fuwari-btn-regular-bg) fuwari-text-50 border border-(--fuwari-input-border)"
          : "border-border/40 bg-muted/50 text-muted-foreground",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        outline: isFuwari
          ? "border border-(--fuwari-input-border) fuwari-text-75"
          : "border-border/40 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
