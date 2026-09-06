import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2, RefreshCw, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResendAnnouncement } from "@/features/announcements/hooks/use-announcement-actions";
import { announcementDeliveriesQuery } from "@/features/announcements/queries";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

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

  if (isFuwari) {
    return createPortal(
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300">
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/50"
          onClick={onClose}
        />
        <div className="relative w-full max-w-3xl fuwari-card-base p-5 sm:p-6 flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-(--fuwari-input-border)">
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] fuwari-text-30">
                [ {m.announcements_detail_title()} ]
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-(--fuwari-btn-regular-bg) rounded-lg px-2.5 py-1 text-xs font-medium fuwari-text-75">
                  {m.announcements_delivery_total({
                    count: deliveryStats?.total ?? 0,
                  })}
                </span>
                <span className="bg-(--fuwari-primary)/10 text-(--fuwari-primary) rounded-lg px-2.5 py-1 text-xs font-medium">
                  {m.announcements_delivery_sent({
                    count: deliveryStats?.sent ?? 0,
                  })}
                </span>
                <span className="bg-destructive/10 text-destructive rounded-lg px-2.5 py-1 text-xs font-medium">
                  {m.announcements_delivery_failed({
                    count: deliveryStats?.failed ?? 0,
                  })}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1 -mr-1 -mt-1 fuwari-text-50 hover:text-(--fuwari-primary) transition-colors"
              aria-label={m.common_close()}
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {/* Body */}
          <div className="py-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div className="flex justify-end mb-3">
              <button
                onClick={handleResend}
                disabled={resendMutation.isPending}
                className="fuwari-btn-regular rounded-xl h-9 px-3.5 text-sm font-medium fuwari-text-75 hover:text-(--fuwari-primary) active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {resendMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} strokeWidth={1.5} />
                )}
                {m.announcements_actions_resend()}
              </button>
            </div>

            {deliveriesQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin fuwari-text-50" />
              </div>
            ) : deliveries.length === 0 ? (
              <p className="fuwari-text-50 text-sm text-center py-16">
                {m.announcements_empty_detail()}
              </p>
            ) : (
              <div>
                <div className="grid grid-cols-4 gap-3 px-2 pb-2 text-xs fuwari-text-50">
                  <span className="font-bold">
                    {m.announcements_delivery_user()}
                  </span>
                  <span className="col-span-2 font-bold">
                    {m.announcements_delivery_email()}
                  </span>
                  <span className="font-bold">
                    {m.announcements_delivery_status()}
                  </span>
                </div>
                {deliveries.map((d) => (
                  <div
                    key={d.id}
                    className="grid grid-cols-4 gap-3 px-2 py-2.5 items-center border-t border-(--fuwari-input-border) hover:bg-(--fuwari-btn-regular-bg) transition-colors"
                  >
                    <span className="text-sm font-bold fuwari-text-90 truncate">
                      {d.userName ?? "-"}
                    </span>
                    <span className="col-span-2 text-sm fuwari-text-50 truncate">
                      {d.email}
                    </span>
                    <FuwariDeliveryStatus status={d.status} />
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

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300">
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl bg-background border border-border/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 flex items-start justify-between border-b border-border/30">
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {m.announcements_detail_title()} ]
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="font-mono text-[10px] uppercase tracking-widest"
              >
                {m.announcements_delivery_total({
                  count: deliveryStats?.total ?? 0,
                })}
              </Badge>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400"
              >
                {m.announcements_delivery_sent({
                  count: deliveryStats?.sent ?? 0,
                })}
              </Badge>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] uppercase tracking-widest text-destructive"
              >
                {m.announcements_delivery_failed({
                  count: deliveryStats?.failed ?? 0,
                })}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
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
              <Loader2
                size={20}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16 font-light">
              {m.announcements_empty_detail()}
            </p>
          ) : (
            <div className="border border-border/30 divide-y divide-border/30">
              <div className="grid grid-cols-4 gap-4 px-4 py-2.5 bg-muted/20 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>{m.announcements_delivery_user()}</span>
                <span className="col-span-2">
                  {m.announcements_delivery_email()}
                </span>
                <span>{m.announcements_delivery_status()}</span>
              </div>
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="grid grid-cols-4 gap-4 px-4 py-3 items-center"
                >
                  <span className="text-xs font-medium text-foreground truncate">
                    {d.userName ?? "-"}
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground truncate">
                    {d.email}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    {d.status === "sent" ? (
                      <span className="text-green-600 dark:text-green-400">
                        {m.announcements_status_sent()}
                      </span>
                    ) : d.status === "failed" ? (
                      <span className="text-destructive">
                        {m.announcements_status_failed()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {m.announcements_status_pending()}
                      </span>
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

function FuwariDeliveryStatus({ status }: { status: string }) {
  if (status === "sent") {
    return (
      <span className="bg-(--fuwari-primary)/10 text-(--fuwari-primary) rounded-lg px-2.5 py-1 text-xs font-medium w-fit">
        {m.announcements_status_sent()}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="bg-destructive/10 text-destructive rounded-lg px-2.5 py-1 text-xs font-medium w-fit">
        {m.announcements_status_failed()}
      </span>
    );
  }
  return (
    <span className="bg-(--fuwari-btn-regular-bg) rounded-lg px-2.5 py-1 text-xs font-medium fuwari-text-75 w-fit">
      {m.announcements_status_pending()}
    </span>
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
