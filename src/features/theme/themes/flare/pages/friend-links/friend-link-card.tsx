import type { FriendLinkWithUser } from "@/features/friend-links/friend-links.schema";

interface FriendLinkCardProps {
  link: Omit<FriendLinkWithUser, "createdAt" | "updatedAt">;
}

export function FriendLinkCard({ link }: FriendLinkCardProps) {
  // Extract domain for display
  const displayUrl = link.siteUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <a
      href={link.siteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 p-4 flare-surface-soft hover:bg-muted/30 transition-colors"
    >
      {/* Logo */}
      <div className="shrink-0 w-11 h-11 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center overflow-hidden">
        {link.logoUrl ? (
          <img
            src={link.logoUrl}
            alt={link.siteName}
            className="w-full h-full object-cover transition-all duration-300"
            loading="lazy"
          />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground/70">
            {link.siteName.slice(0, 1)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-foreground tracking-tight truncate group-hover:text-foreground/85 transition-colors">
            {link.siteName}
          </h3>
          <span
            title={displayUrl}
            className="hidden min-w-0 max-w-[45%] truncate text-xs text-muted-foreground/50 sm:block"
          >
            {displayUrl}
          </span>
        </div>

        <div className="min-h-[2.5em]">
          {link.description ? (
            <p className="text-sm text-muted-foreground/80 leading-relaxed line-clamp-2">
              {link.description}
            </p>
          ) : null}
        </div>
      </div>
    </a>
  );
}
