import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2, RefreshCw, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { announcementDeliveriesQuery } from "@/features/announcements/queries";
import { m } from "@/paraglide/messages";
import { useResendAnnouncement } from "@/features/announcements/hooks/use-announcement-actions";

interface AnnouncementDeliveriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcementId?: number | null;
}

function AnnouncementDeliveriesModalInternal({
  isOpen,
  onClose,
  announcementId,
}: AnnouncementDeliveriesModalProps) {
  const queryClient = useQueryClient();
  const deliveriesQuery = useQuery({
    ...announcementDeliveriesQuery(announcementId ?? 0, { limit: 100 }),
    enabled: isOpen && !!announcementId,
  });
  const resendMutation = useResendAnnouncement();

  if (!isOpen || !announcementId) return null;

  const handleResend = () => {
    resendMutation.mutate(
      { data: { id: announcementId } },
      {
        onSuccess: () => queryClient.invalidateQueries(),
      },
    );
  };

  const deliveryStats = deliveriesQuery.data?.deliveryStats ?? null;
  const deliveries = deliveriesQuery.data?.items ?? [];

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-background border border-border/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 flex items-start justify-between border-b border-border/30">
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {m.announcements_detail_title()} ]
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-widest">
                {m.announcements_delivery_total({ count: deliveryStats?.total ?? 0 })}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400">
                {m.announcements_delivery_sent({ count: deliveryStats?.sent ?? 0 })}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-widest text-destructive">
                {m.announcements_delivery_failed({ count: deliveryStats?.failed ?? 0 })}
              </Badge>
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto">
          <div className="flex justify-end mb-4">
            <Button
              onClick={handleResend}
              disabled={resendMutation.isPending}
              variant="outline"
              className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8"
            >
              {resendMutation.isPending ? (
                <Loader2 size={12} className="animate-spin mr-2" />
              ) : (
                <RefreshCw size={12} className="mr-2" />
              )}
              {m.announcements_actions_resend()}
            </Button>
          </div>

          {deliveriesQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16 font-light">
              {m.announcements_empty_detail()}
            </p>
          ) : (
            <div className="border border-border/30 divide-y divide-border/30">
              <div className="grid grid-cols-4 gap-4 px-4 py-2.5 bg-muted/20 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>{m.announcements_delivery_user()}</span>
                <span className="col-span-2">{m.announcements_delivery_email()}</span>
                <span>{m.announcements_delivery_status()}</span>
              </div>
              {deliveries.map((d) => (
                <div key={d.id} className="grid grid-cols-4 gap-4 px-4 py-3 items-center">
                  <span className="text-xs font-medium text-foreground truncate">
                    {d.userName ?? "-"}
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground truncate">
                    {d.email}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    {d.status === "sent" ? (
                      <span className="text-green-600 dark:text-green-400">{m.announcements_status_sent()}</span>
                    ) : d.status === "failed" ? (
                      <span className="text-destructive">{m.announcements_status_failed()}</span>
                    ) : (
                      <span className="text-muted-foreground">{m.announcements_status_pending()}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AnnouncementDeliveriesModal(props: AnnouncementDeliveriesModalProps) {
  return (
    <ClientOnly>
      <AnnouncementDeliveriesModalInternal {...props} />
    </ClientOnly>
  );
}

export default AnnouncementDeliveriesModal;