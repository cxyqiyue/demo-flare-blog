import { m } from "@/paraglide/messages";
import { FriendLinkSkeleton } from "./friend-link-skeleton";

export function FriendLinksPageSkeleton() {
  return (
    <div className="flex w-full flex-col">
      <section className="flare-surface overflow-hidden">
        <header className="space-y-2 px-5 pb-5 pt-6 md:px-8 md:pt-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.5rem]">
            {m.friend_links_title()}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-[15px]">
            {m.friend_links_desc()}
          </p>
        </header>
        <div className="border-t border-border/50 px-5 py-5 md:px-8 md:py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <FriendLinkSkeleton key={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
