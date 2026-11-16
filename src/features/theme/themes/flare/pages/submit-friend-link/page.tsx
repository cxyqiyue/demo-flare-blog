import { ClientOnly, Link } from "@tanstack/react-router";
import { ExternalLink, Terminal } from "lucide-react";
import type { SubmitFriendLinkPageProps } from "@/features/theme/contract/pages/friend-links";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { FriendLinkSubmitForm } from "./form";

export function SubmitFriendLinkPage(props: SubmitFriendLinkPageProps) {
  const { myLinks, form } = props;
  return (
    <div className="w-full space-y-4 md:space-y-6 flare-enter">
      <section className="flare-surface p-5 md:p-7">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              {m.friend_links_title()}
            </h1>
            <p className="max-w-2xl text-sm md:text-base text-muted-foreground leading-7">
              {m.friend_link_submit_desc()}
            </p>
          </div>
          <Link to="/" className="flare-chip w-fit">
            <Terminal size={14} />
            cd /home
          </Link>
        </div>
      </section>

      <section className="flare-surface p-5 md:p-7 space-y-5">
        <h3 className="text-base md:text-lg font-semibold text-foreground">
          {m.friend_link_submit_form_title()}
        </h3>
        <FriendLinkSubmitForm form={form} />
      </section>

      {myLinks.length > 0 && (
        <section className="flare-surface p-5 md:p-7 space-y-5">
          <h3 className="text-base md:text-lg font-semibold text-foreground">
            {m.friend_link_my_submissions()}
          </h3>
          <div className="space-y-3">
            {myLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-start justify-between gap-4 py-4 border-b border-border/30 last:border-b-0"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm md:text-base font-medium text-foreground">
                      {link.siteName}
                    </span>
                    <FriendLinkStatusBadge status={link.status} />
                  </div>
                  <a
                    href={link.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 max-w-full"
                  >
                    <ExternalLink size={12} className="shrink-0" />
                    <span className="truncate">{link.siteUrl}</span>
                  </a>
                  {link.rejectionReason && (
                    <p className="text-xs text-orange-500">
                      {m.friend_link_rejection_reason()}: {link.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  <ClientOnly fallback="-">
                    {formatDate(link.createdAt).split(" ")[0]}
                  </ClientOnly>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FriendLinkStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    approved: m.friend_link_status_approved(),
    pending: m.friend_link_status_pending(),
    rejected: m.friend_link_status_rejected(),
  };

  const styles: Record<string, string> = {
    approved: "text-green-600 border-green-600/30",
    pending: "text-amber-500 border-amber-500/30",
    rejected: "text-red-500 border-red-500/30",
  };

  return (
    <span
      className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles[status] || "text-muted-foreground border-border"}`}
    >
      {labels[status] || status}
    </span>
  );
}
