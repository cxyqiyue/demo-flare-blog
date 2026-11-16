import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SiteInfoAndApplyRules } from "@/features/friend-links/components/site-info-and-apply-rules";
import type { FriendLinksPageProps } from "@/features/theme/contract/pages";
import { m } from "@/paraglide/messages";
import { FriendLinkCard } from "./friend-link-card";

export function FriendLinksPage({
  links,
  siteInfo,
  applyRules,
}: FriendLinksPageProps) {
  return (
    <div className="flare-enter flex w-full flex-col gap-4">
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
          {links.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                {m.friend_links_no_links()}
              </p>
              <p className="mt-2 text-sm text-muted-foreground/70">
                {m.friend_links_first_link()}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {links.map((link) => (
                <FriendLinkCard key={link.id} link={link} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-8 border-t border-border/50 px-5 py-6 md:px-8 md:py-7">
          <SiteInfoAndApplyRules siteInfo={siteInfo} applyRules={applyRules} />
          <div className="flex flex-col justify-between gap-4 border-t border-border/50 pt-6 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">
                {m.friend_links_join_title()}
              </h3>
              <p className="text-sm text-muted-foreground">
                {m.friend_links_join_desc()}
              </p>
            </div>
            <Link to="/submit-friend-link" className="flare-chip">
              <span>{m.friend_links_apply()}</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
