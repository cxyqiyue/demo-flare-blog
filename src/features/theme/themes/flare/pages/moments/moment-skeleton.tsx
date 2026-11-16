import { Skeleton } from "@/components/ui/skeleton";

export function MomentSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-5 md:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}
