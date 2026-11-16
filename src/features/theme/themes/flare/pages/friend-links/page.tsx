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
    <div className="w-full space-y-4 md:space-y-6 flare-enter">
      <section className="flare-surface p-5 md:p-7">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {m.friend_links_title()}
          </h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-7">
            {m.friend_links_desc()}
          </p>
        </header>
      </section>

      <section className="flare-surface p-5 md:p-7">
        {links.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">{m.friend_links_no_links()}</p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              {m.friend_links_first_link()}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {links.map((link) => (
              <FriendLinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </section>

      <section className="flare-surface p-5 md:p-7 space-y-8">
        <SiteInfoAndApplyRules siteInfo={siteInfo} applyRules={applyRules} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-border/40">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">
              {m.friend_links_join_title()}
            </h3>
            <p className="text-sm text-muted-foreground">
              {m.friend_links_join_desc()}
            </p>
          </div>
          <Link
            to="/submit-friend-link"
            className="flare-chip"
          >
            <span>{m.friend_links_apply()}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
