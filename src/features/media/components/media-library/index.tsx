import { ChevronRight, Folder, Home, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { formatBytes } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import {
  FolderModal,
  MediaGrid,
  MediaPreviewModal,
  MediaTable,
  MediaToolbar,
  ProviderSelector,
  UploadModal,
} from "./components";
import { useMediaLibrary, useMediaProviders, useMediaUpload } from "./hooks";
import type { MediaDirectoryFile, MediaFolder } from "./types";

export function MediaLibrary() {
  const { providers } = useMediaProviders();
  const {
    currentProviderId,
    currentProvider,
    setProvider,
    isExternal,
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
    externalError,
  } = useMediaLibrary(providers);

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
    canUpload,
  } = useMediaUpload({ provider: currentProvider });

  // Upload is always available for any provider that supports it
  const uploadDisabled = !canUpload;

  // View State
  const [previewAsset, setPreviewAsset] = useState<MediaDirectoryFile | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState<MediaFolder | null>(null);

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
      ? m.media_delete_confirm_mixed({ folders: deletePreview.folders, files: deletePreview.files })
      : deletePreview.folders > 0
        ? m.media_delete_confirm_folders({ count: deletePreview.folders })
        : m.media_delete_confirm_desc({ count: deletePreview.files })
    : m.media_delete_confirm_desc({ count: deleteTarget?.length ?? 0 });

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex justify-between items-end gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both border-b border-border/30 pb-6">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-serif font-medium tracking-tight">
            {m.media_title()}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] md:text-xs font-mono text-muted-foreground uppercase tracking-widest">
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
          title={uploadDisabled ? m.media_upload_disabled_by_image_hosting_desc() : undefined}
          className="h-9 md:h-10 px-4 md:px-6 text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-medium rounded-none gap-2 bg-foreground text-background hover:bg-foreground/90 transition-all border border-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-foreground shrink-0"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">{m.media_upload_btn()}</span>
        </Button>
      </div>

      {uploadDisabled && !isExternal && (
        <div className="border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-amber-600">
            {m.media_upload_disabled_by_image_hosting_title()}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {m.media_upload_disabled_by_image_hosting_desc()}
          </p>
        </div>
      )}

      {/* Provider Selector */}
      <ProviderSelector
        providers={providers}
        currentId={currentProviderId}
        onSelect={setProvider}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1 flex-wrap text-xs font-mono uppercase tracking-widest"
      >
        <button
          type="button"
          onClick={() => setFolder("")}
          className={`flex items-center gap-1.5 py-1 px-2 transition-colors ${
            currentFolder ? "text-muted-foreground hover:text-foreground" : "text-foreground font-bold"
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
                crumb.path === currentFolder ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
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
          onNewFolder={currentProvider?.canCreateFolder ? () => setIsNewFolderOpen(true) : undefined}
          selectedKeys={selectedIds}
          mediaItems={mediaItems}
          canDelete={currentProvider?.canDelete ?? false}
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
        ) : mediaItems.length === 0 && folders.length === 0 && isExternal ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {externalError ? (
              <>
                <p className="text-xs font-mono uppercase tracking-widest text-destructive">
                  {externalError}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {m.media_empty_provider()}
                </p>
              </>
            ) : (
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {m.media_empty_provider()}
              </p>
            )}
          </div>
        ) : view === "table" ? (
          <MediaTable
            media={mediaItems}
            folders={folders}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelection}
            onPreview={setPreviewAsset}
            onOpenFolder={setFolder}
            onRenameFolder={currentProvider?.canCreateFolder ? setRenameFolderTarget : undefined}
            onDeleteFolder={currentProvider?.canDelete ? handleFolderDelete : undefined}
            onRenameFile={!isExternal ? setPreviewAsset : undefined}
            onDeleteFile={currentProvider?.canDelete ? handleFileDelete : undefined}
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
            onRenameFolder={currentProvider?.canCreateFolder ? setRenameFolderTarget : undefined}
            onDeleteFolder={currentProvider?.canDelete ? handleFolderDelete : undefined}
            onLoadMore={loadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            linkedMediaIds={!isExternal ? linkedMediaIds : undefined}
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
        onFileSelect={uploadDisabled ? () => {} : (files) => processFiles(files, currentFolder)}
        onDragOver={uploadDisabled ? () => {} : handleDragOver}
        onDragLeave={uploadDisabled ? () => {} : handleDragLeave}
        onDrop={uploadDisabled ? () => {} : handleDrop}
      />

      {/* --- New Folder Modal --- */}
      <FolderModal
        isOpen={isNewFolderOpen}
        mode="create"
        parentLabel={currentFolder ? `${m.media_folder_parent()}: /${currentFolder}` : `${m.media_folder_parent()}: /`}
        onClose={() => setIsNewFolderOpen(false)}
        onSubmit={(name) => {
          createFolder.mutate(name, { onSettled: () => setIsNewFolderOpen(false) });
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
          renameFolder.mutate({ key: renameFolderTarget.key, name }, { onSettled: () => setRenameFolderTarget(null) });
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
        onUpdateName={!isExternal ? async (key, name) => { await updateAsset.mutateAsync({ data: { key, name } }); } : undefined}
        onDelete={currentProvider?.canDelete ? async (key) => {
          const allowed = requestDelete([key]);
          if (allowed.length > 0) confirmDelete(allowed);
        } : undefined}
      />
    </div>
  );
}
