import { isFuwari } from "@/lib/theme-mode";

export function PostEditorSkeleton() {
  if (isFuwari) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-5 fuwari-card-base">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-(--fuwari-btn-regular-bg)" />
            <div className="w-12 h-3 rounded-lg bg-(--fuwari-btn-regular-bg)" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-8 rounded-xl bg-(--fuwari-btn-regular-bg)" />
            <div className="w-24 h-8 rounded-xl bg-(--fuwari-btn-regular-bg)" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4 items-start">
          <div className="flex flex-col gap-4">
            {/* Metadata Card Skeleton */}
            <div className="fuwari-card-base p-4 sm:p-5 md:p-6">
              {/* Title Skeleton */}
              <div className="mb-6">
                <div className="h-10 w-3/4 rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                {/* Status */}
                <div className="space-y-2">
                  <div className="h-3 w-12 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                  <div className="h-8 w-24 rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
                </div>
                {/* Date */}
                <div className="space-y-2">
                  <div className="h-3 w-12 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                  <div className="h-8 w-32 rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
                </div>
                {/* Read Time */}
                <div className="space-y-2">
                  <div className="h-3 w-12 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                  <div className="h-8 w-16 rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
                </div>

                {/* Slug */}
                <div className="col-span-1 md:col-span-3 space-y-2">
                  <div className="h-3 w-12 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                  <div className="h-9 w-full rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
                </div>

                {/* Tags */}
                <div className="col-span-1 md:col-span-3 space-y-2">
                  <div className="h-3 w-12 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                  <div className="flex gap-2">
                    <div className="h-8 w-20 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                    <div className="h-8 w-24 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                  </div>
                </div>

                {/* Summary */}
                <div className="col-span-1 md:col-span-3 space-y-2">
                  <div className="h-3 w-12 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                  <div className="h-20 w-full rounded-xl bg-(--fuwari-btn-regular-bg)"></div>
                </div>
              </div>
            </div>

            {/* Editor Area Skeleton */}
            <div className="fuwari-card-base p-4 sm:p-5 md:p-6">
              <div className="space-y-3">
                <div className="h-4 w-full rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                <div className="h-4 w-5/6 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                <div className="h-4 w-4/6 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
                <div className="h-4 w-full rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
              </div>
            </div>
          </div>

          {/* Sidebar TOC Skeleton */}
          <div className="hidden xl:block flex flex-col gap-4">
            <div className="fuwari-card-base p-4">
              <div className="h-3 w-16 rounded-lg bg-(--fuwari-btn-regular-bg) mb-4"></div>
              <div className="h-3 w-32 rounded-lg bg-(--fuwari-btn-regular-bg)"></div>
              <div className="h-3 w-24 rounded-lg bg-(--fuwari-btn-regular-bg) mt-3 ml-4"></div>
              <div className="h-3 w-28 rounded-lg bg-(--fuwari-btn-regular-bg) mt-3"></div>
              <div className="h-3 w-20 rounded-lg bg-(--fuwari-btn-regular-bg) mt-3 ml-4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-80 flex flex-col bg-background overflow-hidden animate-pulse">
      {/* Header Skeleton */}
      <header className="h-20 flex items-center justify-between px-8 shrink-0 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-accent rounded-full" />
          <div className="w-12 h-3 bg-accent rounded-sm opacity-20" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28 h-10 bg-accent rounded-full" />
          <div className="w-28 h-10 bg-accent rounded-full" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="w-full max-w-7xl mx-auto py-20 px-6 md:px-12 grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-12 items-start">
          <div className="min-w-0 w-full max-w-4xl mx-auto">
            {/* Title Skeleton */}
            <div className="mb-12">
              <div className="h-16 w-3/4 bg-muted/30 rounded-none"></div>
            </div>

            {/* Metadata Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8 mb-16 border-t border-border/30 pt-8">
              {/* Status */}
              <div className="space-y-3">
                <div className="h-3 w-12 bg-muted/40 rounded-none"></div>
                <div className="h-5 w-24 bg-muted/30 rounded-none"></div>
              </div>
              {/* Date */}
              <div className="space-y-3">
                <div className="h-3 w-12 bg-muted/40 rounded-none"></div>
                <div className="h-5 w-32 bg-muted/30 rounded-none"></div>
              </div>
              {/* Read Time */}
              <div className="space-y-3">
                <div className="h-3 w-12 bg-muted/40 rounded-none"></div>
                <div className="h-5 w-16 bg-muted/30 rounded-none"></div>
              </div>

              {/* Slug */}
              <div className="col-span-1 md:col-span-3 space-y-3">
                <div className="h-3 w-12 bg-muted/40 rounded-none"></div>
                <div className="h-5 w-full bg-muted/30 rounded-none"></div>
              </div>

              {/* Tags */}
              <div className="col-span-1 md:col-span-3 space-y-3">
                <div className="h-3 w-12 bg-muted/40 rounded-none"></div>
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-muted/30 rounded-none"></div>
                  <div className="h-6 w-20 bg-muted/30 rounded-none"></div>
                </div>
              </div>

              {/* Summary */}
              <div className="col-span-1 md:col-span-3 space-y-3">
                <div className="h-3 w-12 bg-muted/40 rounded-none"></div>
                <div className="h-20 w-full bg-muted/30 rounded-none"></div>
              </div>
            </div>

            {/* Editor Area Skeleton */}
            <div className="space-y-4">
              <div className="h-4 w-full bg-muted/20 rounded-none"></div>
              <div className="h-4 w-5/6 bg-muted/20 rounded-none"></div>
              <div className="h-4 w-4/6 bg-muted/20 rounded-none"></div>
              <div className="h-4 w-full bg-muted/20 rounded-none"></div>
            </div>
          </div>

          {/* Sidebar TOC Skeleton */}
          <div className="hidden xl:block mt-8 space-y-4 border-l border-border/30 pl-4">
            <div className="h-3 w-16 bg-muted/40 rounded-none mb-6"></div>
            <div className="h-3 w-32 bg-muted/20 rounded-none"></div>
            <div className="h-3 w-24 bg-muted/20 rounded-none pl-4"></div>
            <div className="h-3 w-28 bg-muted/20 rounded-none"></div>
            <div className="h-3 w-20 bg-muted/20 rounded-none pl-4"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
