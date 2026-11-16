import { ClientOnly, Link } from "@tanstack/react-router";
import { ExternalLink, Terminal } from "lucide-react";
import type { SubmitFriendLinkPageProps } from "@/features/theme/contract/pages/friend-links";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { FriendLinkSubmitForm } from "./form";

export function SubmitFriendLinkPage(props: SubmitFriendLinkPageProps) {
  const { myLinks, form } = props;
  return (
    <div className="flare-enter flex w-full flex-col gap-4">
      <section className="flare-surface overflow-hidden">
        <header className="flex flex-col gap-4 px-5 pb-5 pt-6 md:flex-row md:items-start md:justify-between md:px-8 md:pt-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.5rem]">
              {m.friend_links_title()}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-[15px]">
              {m.friend_link_submit_desc()}
            </p>
          </div>
          <Link to="/" className="flare-chip w-fit shrink-0">
            <Terminal size={14} />
            cd /home
          </Link>
        </header>

        <div className="space-y-5 border-t border-border/50 px-5 py-6 md:px-8 md:py-7">
          <h2 className="text-base font-semibold text-foreground md:text-lg">
            {m.friend_link_submit_form_title()}
          </h2>
          <FriendLinkSubmitForm form={form} />
        </div>

        {myLinks.length > 0 ? (
          <div className="space-y-4 border-t border-border/50 px-5 py-6 md:px-8 md:py-7">
            <h2 className="text-base font-semibold text-foreground md:text-lg">
              {m.friend_link_my_submissions()}
            </h2>
            <div className="divide-y divide-border/50">
              {myLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground md:text-base">
                        {link.siteName}
                      </span>
                      <FriendLinkStatusBadge status={link.status} />
                    </div>
                    <a
                      href={link.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground md:text-sm"
                    >
                      <ExternalLink size={12} className="shrink-0" />
                      <span className="truncate">{link.siteUrl}</span>
                    </a>
                    {link.rejectionReason ? (
                      <p className="text-xs text-orange-500">
                        {m.friend_link_rejection_reason()}:{" "}
                        {link.rejectionReason}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    <ClientOnly fallback="-">
                      {formatDate(link.createdAt).split(" ")[0]}
                    </ClientOnly>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
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
