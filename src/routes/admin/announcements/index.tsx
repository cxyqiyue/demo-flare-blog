import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import AnnouncementFormModal from "@/features/announcements/components/admin/announcement-form-modal";
import { AnnouncementsTable } from "@/features/announcements/components/admin/announcements-table";
import type { Announcement } from "@/lib/db/schema";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/admin/announcements/")({
  ssr: false,
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

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-border/30 pb-6">
        <div className="flex items-center gap-3">
          <Megaphone size={18} strokeWidth={1.5} className="text-muted-foreground" />
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