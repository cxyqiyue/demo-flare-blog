import { Skeleton } from "@/components/ui/skeleton";
import { isFuwari } from "@/lib/theme-mode";

export function DashboardSkeleton() {
  if (isFuwari) {
    return <FuwariDashboardSkeleton />;
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-6 border border-border/30 rounded-sm space-y-4"
          >
            <div className="flex justify-between items-start">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-5 rounded-sm" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </div>

      {/* Visuals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Graph Skeleton */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-row justify-between items-baseline border-b border-border/50 pb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-32" />
          </div>
          <div className="h-72 w-full flex items-end gap-1.5 md:gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-[1px]"
                style={{ height: `${Math.random() * 70 + 10}%` }}
              />
            ))}
          </div>
        </div>

        {/* Activity Log Skeleton */}
        <div className="space-y-6">
          <div className="flex flex-row justify-between items-baseline border-b border-border/50 pb-4">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FuwariDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 fuwari-onload-animation">
      {/* Header card */}
      <div
        className="fuwari-card-base p-4 sm:p-5 md:p-6 flex items-center justify-between fuwari-onload-animation"
        style={{ animationDelay: "100ms" }}
      >
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40 rounded-xl hidden sm:block" />
      </div>

      {/* Stats cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 fuwari-onload-animation"
        style={{ animationDelay: "150ms" }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="fuwari-card-base p-4 sm:p-5 space-y-4">
            <div className="flex justify-between items-start">
              <Skeleton className="h-4 w-24 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Cloudflare usage skeleton */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 fuwari-onload-animation"
        style={{ animationDelay: "250ms" }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="fuwari-card-base p-4 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* Traffic + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-2 fuwari-card-base p-4 sm:p-5 md:p-6 space-y-5 fuwari-onload-animation"
          style={{ animationDelay: "350ms" }}
        >
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
          <div className="h-56 flex items-end gap-1.5 md:gap-3">
            {Array.from({ length: 18 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${((i * 7) % 60) + 18}%` }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div
            className="fuwari-card-base p-4 sm:p-5 space-y-3 fuwari-onload-animation"
            style={{ animationDelay: "450ms" }}
          >
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          <div
            className="fuwari-card-base p-4 sm:p-5 space-y-4 fuwari-onload-animation"
            style={{ animationDelay: "550ms" }}
          >
            <Skeleton className="h-6 w-28" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-3 w-14 shrink-0" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
