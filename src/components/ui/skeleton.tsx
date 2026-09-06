import { isFuwari } from "@/lib/theme-mode";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted/30",
        isFuwari && "bg-(--fuwari-btn-regular-bg)!",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
