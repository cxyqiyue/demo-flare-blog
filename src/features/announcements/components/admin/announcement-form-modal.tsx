import { ClientOnly } from "@tanstack/react-router";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateAnnouncement,
  useUpdateAnnouncement,
} from "@/features/announcements/hooks/use-announcement-actions";
import type { Announcement } from "@/lib/db/schema";
import { isFuwari } from "@/lib/theme-mode";
import { m } from "@/paraglide/messages";

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

  if (isFuwari) {
    return createPortal(
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 transition-all duration-300">
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/50"
          onClick={onClose}
        />
        <div className="relative w-full max-w-2xl fuwari-card-base p-5 sm:p-6 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-(--fuwari-input-border)">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] fuwari-text-30">
                [ {m.announcements_admin_tag()} ]
              </p>
              <h2 className="text-xl font-bold fuwari-text-90">
                {isEdit
                  ? m.announcements_edit_title()
                  : m.announcements_create_title()}
              </h2>
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
          <div className="py-5 space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold fuwari-text-75">
                {m.announcements_create_label_title()}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={m.announcements_create_label_title()}
              />
              {titleError && (
                <p className="text-xs text-destructive font-medium">
                  {titleError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold fuwari-text-75">
                {m.announcements_create_label_subject()}
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={m.announcements_create_label_subject()}
              />
              {subjectError && (
                <p className="text-xs text-destructive font-medium">
                  {subjectError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold fuwari-text-75">
                {m.announcements_create_label_body()}
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"<p>"}
              />
              {bodyError && (
                <p className="text-xs text-destructive font-medium">
                  {bodyError}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-5 border-t border-(--fuwari-input-border)">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="fuwari-btn-regular rounded-xl h-10 px-4 text-sm font-medium fuwari-text-75 hover:text-(--fuwari-primary) active:scale-95 transition-all disabled:opacity-50"
            >
              {m.announcements_create_cancel()}
            </button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-10 px-5 text-sm font-bold active:scale-95 transition-all"
            >
              {isSubmitting && (
                <Loader2 size={16} className="animate-spin mr-1.5" />
              )}
              {m.announcements_create_submit()}
            </Button>
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
      <div className="relative w-full max-w-2xl bg-background border border-border/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 flex items-start justify-between border-b border-border/30">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              [ {m.announcements_admin_tag()} ]
            </p>
            <h2 className="text-2xl font-serif font-medium text-foreground">
              {isEdit
                ? m.announcements_edit_title()
                : m.announcements_create_title()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
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
              <p className="text-[11px] text-destructive font-mono">
                {titleError}
              </p>
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
              <p className="text-[11px] text-destructive font-mono">
                {subjectError}
              </p>
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
              <p className="text-[11px] text-destructive font-mono">
                {bodyError}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3 border-t border-border/30 pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="font-mono text-xs uppercase tracking-widest"
          >
            {m.announcements_create_cancel()}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4"
          >
            {isSubmitting && (
              <Loader2 size={14} className="animate-spin mr-2" />
            )}
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
      <AnnouncementFormModalInternal
        key={props.announcement?.id ?? "new"}
        {...props}
      />
    </ClientOnly>
  );
}

export default AnnouncementFormModal;
