import { ClientOnly } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Announcement } from "@/lib/db/schema";
import { m } from "@/paraglide/messages";
import { useCreateAnnouncement, useUpdateAnnouncement } from "@/features/announcements/hooks/use-announcement-actions";

interface AnnouncementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement?: Announcement | null;
}

function AnnouncementFormModalInternal({
  isOpen,
  onClose,
  announcement,
}: AnnouncementFormModalProps) {
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [subject, setSubject] = useState(announcement?.subject ?? "");
  const [body, setBody] = useState(announcement?.bodyHtml ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isEdit = !!announcement;

  if (!isOpen) return null;

  const resetErrors = () => {
    setTitleError(null);
    setSubjectError(null);
    setBodyError(null);
  };

  const handleSubmit = async () => {
    resetErrors();
    let valid = true;
    if (!title.trim()) {
      setTitleError(m.announcements_validation_title_required());
      valid = false;
    }
    if (!subject.trim()) {
      setSubjectError(m.announcements_validation_subject_required());
      valid = false;
    }
    if (!body.trim()) {
      setBodyError(m.announcements_validation_body_required());
      valid = false;
    }
    if (!valid) return;

    const input = {
      title: title.trim(),
      subject: subject.trim(),
      bodyHtml: body,
    };

    let result;
    if (isEdit && announcement) {
      result = await updateMutation.mutateAsync({
        data: { id: announcement.id, ...input },
      });
    } else {
      result = await createMutation.mutateAsync({ data: input });
    }

    if (!result.error) {
      setTitle("");
      setSubject("");
      setBody("");
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-background border border-border/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 flex items-start justify-between border-b border-border/30">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {m.announcements_admin_tag()} ]
            </p>
            <h2 className="text-2xl font-serif font-medium text-foreground">
              {isEdit ? m.announcements_edit_title() : m.announcements_create_title()}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {m.announcements_create_label_title()}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-none"
              placeholder={m.announcements_create_label_title()}
            />
            {titleError && (
              <p className="text-[11px] text-destructive font-mono">{titleError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {m.announcements_create_label_subject()}
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-none"
              placeholder={m.announcements_create_label_subject()}
            />
            {subjectError && (
              <p className="text-[11px] text-destructive font-mono">{subjectError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {m.announcements_create_label_body()}
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-none min-h-48 font-mono text-xs"
              placeholder={"<p>"}
            />
            {bodyError && (
              <p className="text-[11px] text-destructive font-mono">{bodyError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3 border-t border-border/30 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-mono text-xs uppercase tracking-widest">
            {m.announcements_create_cancel()}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
            {m.announcements_create_submit()}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AnnouncementFormModal(props: AnnouncementFormModalProps) {
  return (
    <ClientOnly>
      <AnnouncementFormModalInternal key={props.announcement?.id ?? "new"} {...props} />
    </ClientOnly>
  );
}

export default AnnouncementFormModal;