import { useQuery } from "@tanstack/react-query";
import { Edit3, Eye, Loader2, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import {
  useDeleteAnnouncement,
  useSendAnnouncement,
} from "@/features/announcements/hooks/use-announcement-actions";
import { announcementsListQuery } from "@/features/announcements/queries";
import type { Announcement } from "@/lib/db/schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";
import AnnouncementDeliveriesModal from "./announcement-deliveries-modal";

export function AnnouncementsTable({
  onEdit,
  onNew,
}: {
  onEdit: (announcement: Announcement) => void;
  onNew: () => void;
}) {
  const listQuery = useQuery(announcementsListQuery({ limit: 50 }));
  const [viewId, setViewId] = useState<number | null>(null);

  if (isFuwari) {
    return (
      <FuwariAnnouncementsTable
        isLoading={listQuery.isLoading}
        items={listQuery.data?.items ?? []}
        onView={(id) => setViewId(id)}
        onEdit={onEdit}
        onNew={onNew}
        viewId={viewId}
        onCloseView={() => setViewId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : !listQuery.data || listQuery.data.items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground font-light">
            {m.announcements_list_empty()}
          </p>
          <Button
            onClick={onNew}
            className="mt-6 rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4"
          >
            {m.announcements_add_btn()}
          </Button>
        </div>
      ) : (
        <div className="border border-border/30 divide-y divide-border/30">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-muted/20 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>{m.announcements_create_label_title()}</span>
            <span>{m.announcements_delivery_status()}</span>
            <span>{m.announcements_delivery_user()}</span>
            <span />
            <span />
          </div>
          {listQuery.data.items.map((item) => (
            <AnnouncementRow
              key={item.id}
              announcement={item}
              onView={() => setViewId(item.id)}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}

      <AnnouncementDeliveriesModal
        isOpen={viewId !== null}
        onClose={() => setViewId(null)}
        announcementId={viewId}
      />
    </div>
  );
}

function AnnouncementRow({
  announcement,
  onView,
  onEdit,
}: {
  announcement: Announcement;
  onView: (id: number) => void;
  onEdit: (announcement: Announcement) => void;
}) {
  const sendMutation = useSendAnnouncement();
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteAnnouncement();

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-4 items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {announcement.title}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
          {announcement.subject}
        </p>
      </div>

      <div>
        {announcement.status === "sent" ? (
          <span className="text-[10px] font-mono uppercase tracking-widest text-green-600 dark:text-green-400">
            {m.announcements_status_sent()}
          </span>
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {m.announcements_status_draft()}
          </span>
        )}
      </div>

      <div>
        <span className="text-xs text-muted-foreground font-mono">
          {announcement.status === "sent"
            ? m.announcements_count_recipients({
                count: announcement.recipientCount,
              })
            : "–"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {announcement.status === "sent" ? (
          <Button
            onClick={() => onView(announcement.id)}
            variant="ghost"
            className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground"
            title={m.announcements_actions_view_deliveries()}
          >
            <Eye size={14} strokeWidth={1.5} />
          </Button>
        ) : (
          <>
            <Button
              onClick={() => onEdit(announcement)}
              variant="ghost"
              className="h-8 w-8 p-0 rounded-none text-muted-foreground hover:text-foreground"
              title={m.announcements_actions_edit()}
            >
              <Edit3 size={14} strokeWidth={1.5} />
            </Button>
            <Button
              onClick={() => setConfirmSend(true)}
              variant="ghost"
              className="h-8 w-8 p-0 rounded-none text-green-600 dark:text-green-400 hover:text-green-700"
              title={m.announcements_actions_send()}
            >
              <Send size={14} strokeWidth={1.5} />
            </Button>
          </>
        )}
        <Button
          onClick={() => setConfirmDelete(true)}
          variant="ghost"
          className="h-8 w-8 p-0 rounded-none text-destructive hover:text-destructive/80"
          title={m.announcements_actions_delete()}
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </Button>
      </div>

      <div className="w-4" />

      <ConfirmationModal
        isOpen={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => sendMutation.mutate({ data: { id: announcement.id } })}
        title={m.announcements_send_title()}
        message={m.announcements_send_message({ title: announcement.title })}
        confirmLabel={m.announcements_send_confirm()}
        isLoading={sendMutation.isPending}
      />

      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          deleteMutation.mutate({ data: { id: announcement.id } })
        }
        title={m.announcements_delete_title()}
        message={m.announcements_delete_message()}
        confirmLabel={m.announcements_delete_confirm()}
        isDanger
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

function FuwariAnnouncementsTable({
  isLoading,
  items,
  onView,
  onEdit,
  onNew,
  viewId,
  onCloseView,
}: {
  isLoading: boolean;
  items: Announcement[];
  onView: (id: number) => void;
  onEdit: (announcement: Announcement) => void;
  onNew: () => void;
  viewId: number | null;
  onCloseView: () => void;
}) {
  return (
    <div className="fuwari-card-base p-4 sm:p-5 md:p-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin fuwari-text-50" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-4">
          <p className="fuwari-text-50 text-sm">
            {m.announcements_list_empty()}
          </p>
          <Button
            onClick={onNew}
            className="h-10 px-4 text-sm font-bold active:scale-95 transition-all"
          >
            {m.announcements_add_btn()}
          </Button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-2 pb-2 text-xs fuwari-text-50">
            <span className="font-bold">
              {m.announcements_create_label_title()}
            </span>
            <span className="font-bold">
              {m.announcements_delivery_status()}
            </span>
            <span className="font-bold">{m.announcements_delivery_user()}</span>
            <span />
            <span />
          </div>
          <div>
            {items.map((item) => (
              <FuwariAnnouncementRow
                key={item.id}
                announcement={item}
                onView={onView}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      )}

      <AnnouncementDeliveriesModal
        isOpen={viewId !== null}
        onClose={onCloseView}
        announcementId={viewId}
      />
    </div>
  );
}

function FuwariAnnouncementRow({
  announcement,
  onView,
  onEdit,
}: {
  announcement: Announcement;
  onView: (id: number) => void;
  onEdit: (announcement: Announcement) => void;
}) {
  const sendMutation = useSendAnnouncement();
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteAnnouncement();

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-2 py-3 border-t border-(--fuwari-input-border) hover:bg-(--fuwari-btn-regular-bg) transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-bold fuwari-text-90 truncate">
          {announcement.title}
        </p>
        <p className="text-xs fuwari-text-50 mt-0.5 truncate">
          {announcement.subject}
        </p>
      </div>

      <FuwariStatusChip sent={announcement.status === "sent"} />

      <div className="text-sm fuwari-text-50">
        {announcement.status === "sent"
          ? m.announcements_count_recipients({
              count: announcement.recipientCount,
            })
          : "–"}
      </div>

      <div className="flex items-center gap-0.5">
        {announcement.status === "sent" ? (
          <button
            onClick={() => onView(announcement.id)}
            className="fuwari-btn-regular rounded-lg h-9 w-9 active:scale-90 hover:text-(--fuwari-primary) transition-colors"
            title={m.announcements_actions_view_deliveries()}
          >
            <Eye size={16} strokeWidth={1.5} />
          </button>
        ) : (
          <>
            <button
              onClick={() => onEdit(announcement)}
              className="fuwari-btn-regular rounded-lg h-9 w-9 active:scale-90 hover:text-(--fuwari-primary) transition-colors"
              title={m.announcements_actions_edit()}
            >
              <Edit3 size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setConfirmSend(true)}
              className="fuwari-btn-regular rounded-lg h-9 w-9 active:scale-90 hover:text-(--fuwari-primary) transition-colors"
              title={m.announcements_actions_send()}
            >
              <Send size={16} strokeWidth={1.5} />
            </button>
          </>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          className="fuwari-btn-regular rounded-lg h-9 w-9 active:scale-90 hover:text-red-500 transition-colors"
          title={m.announcements_actions_delete()}
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="w-4" />

      <ConfirmationModal
        isOpen={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => sendMutation.mutate({ data: { id: announcement.id } })}
        title={m.announcements_send_title()}
        message={m.announcements_send_message({ title: announcement.title })}
        confirmLabel={m.announcements_send_confirm()}
        isLoading={sendMutation.isPending}
      />

      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          deleteMutation.mutate({ data: { id: announcement.id } })
        }
        title={m.announcements_delete_title()}
        message={m.announcements_delete_message()}
        confirmLabel={m.announcements_delete_confirm()}
        isDanger
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

function FuwariStatusChip({ sent }: { sent: boolean }) {
  if (sent) {
    return (
      <span className="bg-(--fuwari-primary)/10 text-(--fuwari-primary) rounded-lg px-2.5 py-1 text-xs font-medium">
        {m.announcements_status_sent()}
      </span>
    );
  }
  return (
    <span className="bg-(--fuwari-btn-regular-bg) rounded-lg px-2.5 py-1 text-xs font-medium fuwari-text-75">
      {m.announcements_status_draft()}
    </span>
  );
}
