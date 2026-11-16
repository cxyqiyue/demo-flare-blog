export function FriendLinkSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-background/40 animate-pulse">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-muted/30" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="flex justify-between gap-4">
          <div className="h-4 w-1/3 bg-muted/30 rounded" />
          <div className="h-3 w-1/4 bg-muted/20 rounded hidden sm:block" />
        </div>
        <div className="space-y-1.5 pt-1">
          <div className="h-3 w-full bg-muted/20 rounded" />
          <div className="h-3 w-4/5 bg-muted/20 rounded" />
        </div>
      </div>
    </div>
  );
}
