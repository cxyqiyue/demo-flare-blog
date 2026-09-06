import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import AnnouncementFormModal from "@/features/announcements/components/admin/announcement-form-modal";
import { AnnouncementsTable } from "@/features/announcements/components/admin/announcements-table";
import { requireSuperAdminRoute } from "@/lib/auth/route-guards";
import type { Announcement } from "@/lib/db/schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/announcements/")({
  ssr: false,
  beforeLoad: requireSuperAdminRoute,
  component: AnnouncementsAdminPage,
  loader: () => ({
    title: m.announcements_admin_title(),
  }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }],
  }),
});

function AnnouncementsAdminPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditing(announcement);
    setFormOpen(true);
  };

  if (isFuwari) {
    return (
      <FuwariAnnouncementsAdminPage
        onNew={handleNew}
        onEdit={handleEdit}
        formOpen={formOpen}
        onCloseForm={() => setFormOpen(false)}
        editing={editing}
      />
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-border/30 pb-6">
        <div className="flex items-center gap-3">
          <Megaphone
            size={18}
            strokeWidth={1.5}
            className="text-muted-foreground"
          />
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
              {m.announcements_admin_title()}
            </h1>
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              {m.announcements_admin_tag()}
            </p>
          </div>
        </div>

        <Button
          onClick={handleNew}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4"
        >
          <Plus size={14} className="mr-2" />
          {m.announcements_add_btn()}
        </Button>
      </div>

      {/* Content */}
      <AnnouncementsTable onEdit={handleEdit} onNew={handleNew} />

      {/* Form Modal */}
      <AnnouncementFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        announcement={editing}
      />
    </div>
  );
}

function FuwariAnnouncementsAdminPage({
  onNew,
  onEdit,
  formOpen,
  onCloseForm,
  editing,
}: {
  onNew: () => void;
  onEdit: (announcement: Announcement) => void;
  formOpen: boolean;
  onCloseForm: () => void;
  editing: Announcement | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header card: title + add button */}
      <div className="fuwari-card-base p-4 sm:p-5 md:p-6 fuwari-onload-animation">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="ml-6 min-w-0">
            <h1 className="relative text-xl sm:text-2xl font-bold fuwari-text-90">
              <span
                className="absolute -left-4 top-[6px] w-1 h-5 rounded-md"
                style={{ backgroundColor: "var(--fuwari-primary)" }}
              />
              {m.announcements_admin_title()}
            </h1>
            <p className="text-sm fuwari-text-50 mt-1.5">
              {m.announcements_admin_tag()}
            </p>
          </div>

          <Button
            onClick={onNew}
            className="h-10 px-4 text-sm font-bold active:scale-95 transition-all"
          >
            <Plus size={16} strokeWidth={1.5} className="mr-1.5" />
            {m.announcements_add_btn()}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className="fuwari-onload-animation"
        style={{ animationDelay: "100ms" }}
      >
        <AnnouncementsTable onEdit={onEdit} onNew={onNew} />
      </div>

      {/* Form Modal */}
      <AnnouncementFormModal
        isOpen={formOpen}
        onClose={onCloseForm}
        announcement={editing}
      />
    </div>
  );
}
