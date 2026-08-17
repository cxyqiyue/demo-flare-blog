import { useState } from "react";
import type { MomentWithStats } from "@/features/moments/moments.schema";
import type { MomentsPageProps } from "@/features/theme/contract/pages";
import { Pagination } from "@/features/theme/themes/default/components/pagination";
import { m } from "@/paraglide/messages";
import { MomentCard } from "./moment-card";
import { MomentComposer } from "./moment-composer";

export function MomentsPage({
  moments,
  isAdmin,
  onToggleLike,
  onCreateMoment,
  onUpdateMoment,
  onDeleteMoment,
  page,
  pageSize,
  total,
  hasPrevPage,
  hasNextPage,
  onPageChange,
}: MomentsPageProps) {
  const [editingMoment, setEditingMoment] = useState<MomentWithStats | null>(
    null,
  );

  const handleEdit = (moment: MomentWithStats) => {
    setEditingMoment(moment);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingMoment(null);
  };

  const handleUpdate = async (
    id: number,
    content: import("@tiptap/react").JSONContent,
    images: string[],
  ): Promise<boolean> => {
    const ok = await onUpdateMoment(id, content, images);
    if (ok) {
      setEditingMoment(null);
    }
    return ok;
  };

  return (
    <div className="w-full max-w-3xl mx-auto pb-20 px-6 md:px-0">
      {/* Header */}
      <header className="py-12 md:py-20 space-y-6">
        <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight text-foreground">
          {m.moments_title()}
        </h1>
        <p className="max-w-xl text-base md:text-lg font-light text-muted-foreground leading-relaxed">
          {m.moments_desc()}
        </p>
      </header>

      {/* Admin Composer */}
      {isAdmin && (
        <MomentComposer
          onCreate={onCreateMoment}
          editingMoment={
            editingMoment
              ? {
                  id: editingMoment.id,
                  content: editingMoment.content,
                  images: editingMoment.images,
                }
              : null
          }
          onUpdate={handleUpdate}
          onCancelEdit={handleCancelEdit}
        />
      )}

      {/* Moments List */}
      <div className="space-y-6">
        {moments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-serif text-lg text-muted-foreground/50">
              {m.moments_empty()}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/30 font-mono">
              {m.moments_empty_desc()}
            </p>
          </div>
        ) : (
          <>
            {moments.map((moment) => (
              <MomentCard
                key={moment.id}
                moment={moment}
                isAdmin={isAdmin}
                onToggleLike={onToggleLike}
                onDelete={onDeleteMoment}
                onEdit={handleEdit}
              />
            ))}

            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              hasPrevPage={hasPrevPage}
              hasNextPage={hasNextPage}
              onPageChange={onPageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
