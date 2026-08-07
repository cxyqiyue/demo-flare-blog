import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useArticleImageHostingConfig } from "@/features/image-hosting/hooks/use-article-image-hosting-config";
import { formatBytes } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
  MediaGrid,
  MediaPreviewModal,
  MediaToolbar,
  UploadModal,
} from "./components";
import { useMediaLibrary, useMediaUpload } from "./hooks";
import type { MediaAsset } from "./types";

export function MediaLibrary() {
  // Logic Hooks
  const {
    mediaItems,
    searchQuery,
    setSearchQuery,
    unusedOnly,
    setUnusedOnly,
    selectedIds,
    toggleSelection,
    selectAll,
    deleteTarget,
    isDeleting,
    requestDelete,
    confirmDelete,
    cancelDelete,
    loadMore,
    hasMore,
    isLoadingMore,
    isPending,
    totalMediaSize,
    updateAsset,
    linkedMediaIds,
    refetch,
  } = useMediaLibrary();

  const {
    isOpen: isUploadOpen,
    setIsOpen: setIsUploadOpen,
    queue: uploadQueue,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    processFiles,
    reset: resetUpload,
  } = useMediaUpload();

  const { enabled: articleImageHostingEnabled } =
    useArticleImageHostingConfig();
  // 第三方图床（文章区）启用时关闭 R2 上传入口，避免传错地方
  const uploadDisabled = articleImageHostingEnabled;
  const noop = () => {};

  // View State
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  const handleDeleteRequest = () => {
    requestDelete(Array.from(selectedIds));
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex justify-between items-end animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both border-b border-border/30 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif font-medium tracking-tight">
            {m.media_title()}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              {m.media_stats_assets({
                count: mediaItems.length,
                size: formatBytes(totalMediaSize ?? 0),
              })}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsUploadOpen(true)}
          disabled={uploadDisabled}
          title={
            uploadDisabled
              ? m.media_upload_disabled_by_image_hosting_desc()
              : undefined
          }
          className="h-10 px-6 text-[11px] uppercase tracking-[0.2em] font-medium rounded-none gap-2 bg-foreground text-background hover:bg-foreground/90 transition-all border border-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-foreground"
        >
          <Plus size={14} />
          {m.media_upload_btn()}
        </Button>
      </div>

      {uploadDisabled && (
        <div className="border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-amber-600">
            {m.media_upload_disabled_by_image_hosting_title()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.media_upload_disabled_by_image_hosting_desc()}
          </p>
        </div>
      )}

      <div className="animate-in fade-in duration-1000 delay-100 fill-mode-both space-y-8">
        {/* Toolbar */}
        <MediaToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          unusedOnly={unusedOnly}
          onUnusedOnlyChange={setUnusedOnly}
          selectedCount={selectedIds.size}
          totalCount={mediaItems.length}
          onSelectAll={selectAll}
          onDelete={handleDeleteRequest}
        />

        {/* Media Grid / Partial Skeleton */}
        {isPending ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col space-y-4 animate-pulse">
                <div className="aspect-square bg-muted rounded-none" />
                <div className="space-y-2 px-1">
                  <div className="h-3 w-3/4 bg-muted rounded-none" />
                  <div className="flex justify-between">
                    <div className="h-2 w-1/4 bg-muted rounded-none opacity-50" />
                    <div className="h-2 w-1/4 bg-muted rounded-none opacity-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MediaGrid
            media={mediaItems}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelection}
            onPreview={setPreviewAsset}
            onLoadMore={loadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            linkedMediaIds={linkedMediaIds}
            onRefetch={refetch}
          />
        )}
      </div>

      {/* --- Upload Modal --- */}
      <UploadModal
        isOpen={isUploadOpen}
        queue={uploadQueue}
        isDragging={isDragging}
        onClose={resetUpload}
        onFileSelect={uploadDisabled ? noop : processFiles}
        onDragOver={uploadDisabled ? noop : handleDragOver}
        onDragLeave={uploadDisabled ? noop : handleDragLeave}
        onDrop={uploadDisabled ? noop : handleDrop}
      />

      {/* --- Delete Confirmation Modal --- */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title={m.media_delete_confirm_title()}
        message={m.media_delete_confirm_desc({
          count: deleteTarget?.length ?? 0,
        })}
        confirmLabel={m.media_delete_confirm_btn()}
        isDanger={true}
        isLoading={isDeleting}
      />

      {/* --- Preview Modal --- */}
      <MediaPreviewModal
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        onUpdateName={async (key, name) => {
          await updateAsset.mutateAsync({ data: { key, name } });
        }}
        onDelete={async (key) => {
          const allowed = await requestDelete([key]);
          if (allowed.length > 0) {
            confirmDelete(allowed);
          }
        }}
      />
    </div>
  );
}
