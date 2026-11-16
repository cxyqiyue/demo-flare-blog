import { m } from "@/paraglide/messages";
import { FriendLinkSkeleton } from "./friend-link-skeleton";

export function FriendLinksPageSkeleton() {
  return (
    <div className="w-full mx-auto pb-10 space-y-4 md:space-y-6">
      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm space-y-3">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {m.friend_links_title()}
        </h1>
        <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-7">
          {m.friend_links_desc()}
        </p>
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 md:p-7 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <FriendLinkSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
