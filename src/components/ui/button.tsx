import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  isFuwari
    ? "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all active:scale-[0.98] rounded-xl focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
    : "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: isFuwari
          ? "fuwari-btn-primary rounded-xl shadow-sm"
          : "bg-foreground text-background hover:opacity-80",
        destructive: isFuwari
          ? "bg-destructive text-destructive-foreground rounded-xl hover:opacity-80"
          : "bg-destructive text-destructive-foreground hover:opacity-80",
        outline: isFuwari
          ? "fuwari-btn-regular rounded-xl border border-(--fuwari-input-border)"
          : "border border-border/40 bg-transparent hover:border-foreground",
        secondary: isFuwari
          ? "fuwari-btn-regular rounded-xl"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
        ghost: isFuwari
          ? "rounded-xl fuwari-text-75 hover:bg-(--fuwari-btn-plain-bg-hover) hover:text-(--fuwari-primary)"
          : "hover:bg-accent/50",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: isFuwari ? "h-9 px-4 py-2" : "h-9 px-4 py-2",
        sm: isFuwari ? "h-8 px-3 text-xs rounded-lg" : "h-8 px-3 text-xs",
        lg: isFuwari ? "h-10 px-8" : "h-10 px-8",
        icon: isFuwari ? "h-9 w-9" : "h-9 w-9",
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
