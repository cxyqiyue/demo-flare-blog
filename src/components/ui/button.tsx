import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";
import { isFlare, isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  isFlare
    ? "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [@media(pointer:coarse)]:min-w-11"
    : isFuwari
      ? "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all active:scale-[0.98] rounded-xl focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
      : "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: isFlare
          ? "bg-primary text-primary-foreground shadow-(--flare-shadow-sm) hover:bg-primary/90 active:bg-primary/80"
          : isFuwari
            ? "fuwari-btn-primary rounded-xl shadow-sm"
            : "bg-foreground text-background hover:opacity-80",
        destructive: isFlare
          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80"
          : isFuwari
            ? "bg-destructive text-destructive-foreground rounded-xl hover:opacity-80"
            : "bg-destructive text-destructive-foreground hover:opacity-80",
        outline: isFlare
          ? "border border-(--flare-border-strong) bg-(--flare-surface) text-foreground shadow-(--flare-shadow-sm) hover:bg-(--flare-surface-soft)"
          : isFuwari
            ? "fuwari-btn-regular rounded-xl border border-(--fuwari-input-border)"
            : "border border-border/40 bg-transparent hover:border-foreground",
        secondary: isFlare
          ? "border border-(--flare-border) bg-(--flare-tonal-bg) text-foreground hover:bg-(--flare-tonal-bg-hover) active:bg-(--flare-tonal-bg-active)"
          : isFuwari
            ? "fuwari-btn-regular rounded-xl"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        ghost: isFlare
          ? "text-muted-foreground hover:bg-(--flare-tonal-bg-hover) hover:text-foreground active:bg-(--flare-tonal-bg-active)"
          : isFuwari
            ? "rounded-xl fuwari-text-75 hover:bg-(--fuwari-btn-plain-bg-hover) hover:text-(--fuwari-primary)"
            : "hover:bg-accent/50",
        link: isFlare
          ? "text-primary underline underline-offset-4 hover:decoration-2"
          : "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: isFlare ? "h-11 px-4 py-2" : "h-9 px-4 py-2",
        sm: isFlare
          ? "h-11 px-3 text-sm"
          : isFuwari
            ? "h-8 px-3 text-xs rounded-lg"
            : "h-8 px-3 text-xs",
        lg: isFlare ? "h-12 px-6" : "h-10 px-8",
        icon: isFlare ? "h-11 w-11 shrink-0" : "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  ref,
  className,
  variant,
  size,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
}
Button.displayName = "Button";

export { Button, buttonVariants };
