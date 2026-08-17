import { ChevronRight, Folder, Home, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { useArticleImageHostingConfig } from "@/features/image-hosting/hooks/use-article-image-hosting-config";
import { formatBytes } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
  FolderModal,
  MediaGrid,
  MediaPreviewModal,
  MediaTable,
  MediaToolbar,
  UploadModal,
} from "./components";
import { useMediaLibrary, useMediaUpload } from "./hooks";
import type { MediaDirectoryFile, MediaFolder } from "./types";

export function MediaLibrary() {
  // Logic Hooks
  const {
    mediaItems,
    folders,
    currentFolder,
    setFolder,
    breadcrumbs,
    view,
    setView,
    searchQuery,
    setSearchQuery,
    unusedOnly,
    setUnusedOnly,
    selectedIds,
    toggleSelection,
    selectAll,
    deleteTarget,
    deletePreview,
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
    refetch,
    linkedMediaIds,
    createFolder,
    renameFolder,
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
  const [previewAsset, setPreviewAsset] = useState<MediaDirectoryFile | null>(
    null,
  );
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] =
    useState<MediaFolder | null>(null);

  const isSearching = searchQuery.trim().length > 0;

  const handleDeleteRequest = () => {
    requestDelete(Array.from(selectedIds));
  };

  const handleFileDelete = (asset: MediaDirectoryFile) => {
    const allowed = requestDelete([asset.key]);
    if (allowed.length > 0) {
      confirmDelete(allowed);
    }
  };

  const handleFolderDelete = (folder: MediaFolder) => {
    const allowed = requestDelete([folder.key]);
    if (allowed.length > 0) {
      confirmDelete(allowed);
    }
  };

  const folderLabel = currentFolder
    ? `${m.media_upload_target_folder()}: /${currentFolder}`
    : `${m.media_upload_target_folder()}: /`;

  const confirmMessage = deletePreview
    ? deletePreview.folders > 0 && deletePreview.files > 0
      ? m.media_delete_confirm_mixed({
          folders: deletePreview.folders,
          files: deletePreview.files,
        })
      : deletePreview.folders > 0
        ? m.media_delete_confirm_folders({
            count: deletePreview.folders,
          })
        : m.media_delete_confirm_desc({
            count: deletePreview.files,
          })
    : m.media_delete_confirm_desc({
        count: deleteTarget?.length ?? 0,
      });

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

      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1 flex-wrap text-xs font-mono uppercase tracking-widest"
      >
        <button
          type="button"
          onClick={() => setFolder("")}
          className={`flex items-center gap-1.5 py-1 px-2 transition-colors ${
            currentFolder
              ? "text-muted-foreground hover:text-foreground"
              : "text-foreground font-bold"
          }`}
        >
          <Home size={12} strokeWidth={1.5} />
          {m.media_breadcrumb_root()}
        </button>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-muted-foreground/40" />
            <button
              type="button"
              onClick={() => setFolder(crumb.path)}
              className={`py-1 px-2 transition-colors ${
                crumb.path === currentFolder
                  ? "text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {crumb.label}
            </button>
          </span>
        ))}
        {currentFolder && (
          <span className="flex items-center gap-1 ml-2 text-[9px] text-muted-foreground/50">
            <Folder size={10} />
          </span>
        )}
      </nav>

      <div className="animate-in fade-in duration-1000 delay-100 fill-mode-both space-y-8">
        {/* Toolbar */}
        <MediaToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          unusedOnly={unusedOnly}
          onUnusedOnlyChange={setUnusedOnly}
          view={view}
          onViewChange={setView}
          selectedCount={selectedIds.size}
          totalCount={mediaItems.length + folders.length}
          searching={isSearching}
          onSelectAll={selectAll}
          onDelete={handleDeleteRequest}
          onNewFolder={() => setIsNewFolderOpen(true)}
        />

        {/* Content */}
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
        ) : view === "table" ? (
          <MediaTable
            media={mediaItems}
            folders={folders}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelection}
            onPreview={setPreviewAsset}
            onOpenFolder={setFolder}
            onRenameFolder={setRenameFolderTarget}
            onDeleteFolder={handleFolderDelete}
            onRenameFile={setPreviewAsset}
            onDeleteFile={handleFileDelete}
            onLoadMore={loadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onRefetch={refetch}
          />
        ) : (
          <MediaGrid
            media={mediaItems}
            folders={folders}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelection}
            onPreview={setPreviewAsset}
            onOpenFolder={setFolder}
            onRenameFolder={setRenameFolderTarget}
            onDeleteFolder={handleFolderDelete}
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
        folderLabel={uploadDisabled ? undefined : folderLabel}
        onClose={resetUpload}
        onFileSelect={
          uploadDisabled ? noop : (files) => processFiles(files, currentFolder)
        }
        onDragOver={uploadDisabled ? noop : handleDragOver}
        onDragLeave={uploadDisabled ? noop : handleDragLeave}
        onDrop={uploadDisabled ? noop : handleDrop}
      />

      {/* --- New Folder Modal --- */}
      <FolderModal
        isOpen={isNewFolderOpen}
        mode="create"
        parentLabel={
          currentFolder
            ? `${m.media_folder_parent()}: /${currentFolder}`
            : `${m.media_folder_parent()}: /`
        }
        onClose={() => setIsNewFolderOpen(false)}
        onSubmit={(name) => {
          createFolder.mutate(name, {
            onSettled: () => setIsNewFolderOpen(false),
          });
        }}
        isSubmitting={createFolder.isPending}
      />

      {/* --- Rename Folder Modal --- */}
      <FolderModal
        isOpen={!!renameFolderTarget}
        mode="rename"
        initialName={renameFolderTarget?.name ?? ""}
        onClose={() => setRenameFolderTarget(null)}
        onSubmit={(name) => {
          if (!renameFolderTarget) return;
          renameFolder.mutate(
            { key: renameFolderTarget.key, name },
            {
              onSettled: () => setRenameFolderTarget(null),
            },
          );
        }}
        isSubmitting={renameFolder.isPending}
      />

      {/* --- Delete Confirmation Modal --- */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={cancelDelete}
        onConfirm={() => confirmDelete()}
        title={m.media_delete_confirm_title()}
        message={confirmMessage}
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
          const allowed = requestDelete([key]);
          if (allowed.length > 0) {
            confirmDelete(allowed);
          }
        }}
      />
    </div>
  );
}
