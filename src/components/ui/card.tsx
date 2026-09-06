import type * as React from "react";
import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

// Fuwari cards mirror the public theme: a soft rounded white surface
// floating on the tinted page canvas, with a faint hairline for depth.
const cardShell = isFuwari
  ? "fuwari-card-base"
  : "border border-border/30 bg-card text-card-foreground";

function Card({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn(cardShell, isFuwari && "shadow-sm", className)}
      {...props}
    />
  );
}
Card.displayName = "Card";

function CardHeader({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  );
}
CardHeader.displayName = "CardHeader";

function CardTitle({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  ref?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <h3
      ref={ref}
      className={cn(
        isFuwari
          ? "text-lg font-bold tracking-tight fuwari-text-90"
          : "text-lg font-serif font-medium tracking-tight",
        className,
      )}
      {...props}
    />
  );
}
CardTitle.displayName = "CardTitle";

function CardDescription({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & {
  ref?: React.Ref<HTMLParagraphElement>;
}) {
  return (
    <p
      ref={ref}
      className={cn(
        isFuwari
          ? "text-sm fuwari-text-50"
          : "text-sm text-muted-foreground/70",
        className,
      )}
      {...props}
    />
  );
}
CardDescription.displayName = "CardDescription";

function CardContent({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
}
CardContent.displayName = "CardContent";

function CardFooter({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  );
}
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
