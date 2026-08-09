import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useAdminMoments } from "@/features/moments/hooks/use-moments";
import type { CreateMomentInput } from "@/features/moments/moments.schema";
import { createCreateMomentSchema } from "@/features/moments/moments.schema";
import { allMomentsQuery } from "@/features/moments/queries";
import { formatDate } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
  page: z.number().optional().default(1).catch(1),
});

export const Route = createFileRoute("/admin/moments/")({
  ssr: false,
  validateSearch: searchSchema,
  component: MomentsAdminPage,
  loader: () => {
    return {
      title: m.moments_admin_title(),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
    ],
  }),
});

const PAGE_SIZE = 20;

function MomentsAdminPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: response,
    isLoading,
    isError,
  } = useQuery(
    allMomentsQuery({ offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
  );

  const totalPages = Math.ceil((response?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-border/30 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight text-foreground">
            {m.moments_admin_title()}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              {m.moments_admin_tag()}
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest h-9 px-4"
        >
          <Plus size={14} className="mr-2" />
          {m.moments_admin_create_btn()}
        </Button>
      </div>

      {/* Content */}
      <div className="min-h-100">
        {isLoading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-4 border-t border-border">
            <ShieldAlert size={40} strokeWidth={1} className="opacity-30" />
            <p>{m.moments_admin_load_fail()}</p>
          </div>
        ) : !response || response.items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground font-serif italic gap-4 border-t border-border">
            <p>{m.moments_empty()}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {response.items.map((moment) => (
              <MomentRow key={moment.id} moment={moment} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(response?.total ?? 0) > 0 && (
        <div className="pt-12 px-2 border-t border-border/30">
          <AdminPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={response?.total ?? 0}
            itemsPerPage={PAGE_SIZE}
            currentPageItemCount={response?.items.length ?? 0}
            onPageChange={(newPage) =>
              navigate({
                search: (prev) => ({ ...prev, page: newPage }),
              })
            }
          />
        </div>
      )}

      {/* Create Modal */}
      <MomentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}

function MomentRow({
  moment,
}: {
  moment: {
    id: number;
    content: string;
    createdAt: Date | string;
    author?: { name?: string | null } | null;
  };
}) {
  const { adminDelete, isAdminDeleting } = useAdminMoments();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <div className="group py-6 px-4 hover:bg-muted/10 transition-colors">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 space-y-2">
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {moment.content}
          </p>
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <span>{formatDate(moment.createdAt)}</span>
            {moment.author?.name ? <span>· {moment.author.name}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditModal(true)}
            className="h-7 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground rounded-none gap-1"
          >
            <Pencil size={12} />
            {m.moments_action_edit()}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-7 px-2 text-[10px] font-mono text-muted-foreground hover:text-red-500 rounded-none gap-1"
          >
            <Trash2 size={12} />
            {m.moments_action_delete()}
          </Button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          adminDelete(
            { data: { id: moment.id } },
            { onSuccess: () => setShowDeleteConfirm(false) },
          );
        }}
        title={m.moments_delete_modal_title()}
        message={m.moments_delete_modal_desc()}
        confirmLabel={m.moments_delete_modal_confirm()}
        isDanger={true}
        isLoading={isAdminDeleting}
      />

      <MomentModal
        key={moment.id}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={moment}
      />
    </div>
  );
}

function MomentModal({
  isOpen,
  onClose,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: { id: number; content: string };
}) {
  const { create, update, isCreating, isUpdating } = useAdminMoments();
  const form = useForm<CreateMomentInput>({
    resolver: standardSchemaResolver(createCreateMomentSchema(m)),
    defaultValues: {
      content: initialData?.content ?? "",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = form;

  const content = watch("content");

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = (data: CreateMomentInput) => {
    if (initialData) {
      update(
        { data: { id: initialData.id, ...data } },
        { onSuccess: () => handleClose() },
      );
    } else {
      create({ data }, { onSuccess: () => handleClose() });
    }
  };

  if (!isOpen) return null;

  const isLoading = isCreating || isUpdating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-background border border-border/30 p-8 max-w-lg w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-lg font-serif font-medium mb-6">
          {initialData
            ? m.moments_edit_modal_title()
            : m.moments_create_modal_title()}
        </h3>
        <form onSubmit={handleSubmit(handleConfirm)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {m.moments_form_content()}
            </label>
            <textarea
              {...register("content")}
              className="w-full bg-transparent border border-border/50 px-3 py-2 text-sm font-sans focus:border-foreground focus:outline-none transition-colors resize-none"
              rows={5}
              maxLength={1000}
            />
            {errors.content?.message && (
              <p className="text-xs text-red-500">! {errors.content.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="font-mono text-[10px] uppercase tracking-widest rounded-none"
            >
              {m.moments_modal_cancel()}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !content.trim()}
              className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-[10px] uppercase tracking-widest"
            >
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : initialData ? (
                m.moments_edit_modal_save()
              ) : (
                m.moments_create_modal_confirm()
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
