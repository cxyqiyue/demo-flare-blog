import {
  FileUp,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmationModal from "@/components/ui/confirmation-modal";
import { ImportBookmarkModal } from "@/features/navigation/components/admin/import-bookmark-modal";
import {
  BookmarkFormModal,
  FolderFormModal,
} from "@/features/navigation/components/admin/navigation-modals";
import {
  getHostname,
  useFaviconSource,
} from "@/features/navigation/components/favicon";
import {
  useAdminNavigation,
  useAdminNavigationData,
} from "@/features/navigation/hooks/use-navigation";
import type {
  CreateBookmarkFormValues,
  CreateFolderFormValues,
  NavigationPublicData,
} from "@/features/navigation/navigation.schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type Folder = NavigationPublicData["folders"][number];
type Bookmark = NavigationPublicData["bookmarks"][number];

type BatchDeleteTarget = "folders" | "bookmarks";

export function BookmarkManager() {
  const { data, isPending } = useAdminNavigationData();
  const {
    createFolder,
    updateFolder,
    deleteFolder,
    deleteFolders,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    deleteBookmarks,
  } = useAdminNavigation();

  const [filter, setFilter] = useState<number | "all" | "none">("all");
  const [showImport, setShowImport] = useState(false);
  const [folderModal, setFolderModal] = useState<{
    open: boolean;
    editing: Folder | null;
  }>({ open: false, editing: null });
  const [bookmarkModal, setBookmarkModal] = useState<{
    open: boolean;
    editing: Bookmark | null;
  }>({ open: false, editing: null });
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(
    null,
  );
  const [batchDeleteTarget, setBatchDeleteTarget] =
    useState<BatchDeleteTarget | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<number[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const folders = data?.folders ?? [];
  const bookmarks = data?.bookmarks ?? [];

  const visibleBookmarks = bookmarks
    .filter((bookmark) => {
      if (filter === "all") return true;
      if (filter === "none") return bookmark.folderId === null;
      return bookmark.folderId === filter;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const visibleIds = visibleBookmarks.map((b) => b.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedBookmarkIds.includes(id));

  const busy = (key: string) => busyId === key;

  const toggleFolderSelect = (id: number) => {
    setSelectedFolderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleBookmarkSelect = (id: number) => {
    setSelectedBookmarkIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedBookmarkIds((prev) => {
      const selected = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => selected.delete(id));
      } else {
        visibleIds.forEach((id) => selected.add(id));
      }
      return [...selected];
    });
  };

  const handleFolderSubmit = async (
    input: CreateFolderFormValues,
  ): Promise<boolean> => {
    const editing = folderModal.editing;
    const result = editing
      ? await updateFolder({ data: { id: editing.id, ...input } })
      : await createFolder({ data: input });
    return !!result.data;
  };

  const handleCreateFolder = async (
    input: CreateFolderFormValues,
  ): Promise<number | null> => {
    const result = await createFolder({ data: input });
    return result.data?.id ?? null;
  };

  const handleBookmarkSubmit = async (
    input: CreateBookmarkFormValues,
  ): Promise<boolean> => {
    const editing = bookmarkModal.editing;
    const result = editing
      ? await updateBookmark({ data: { id: editing.id, ...input } })
      : await createBookmark({ data: input });
    return !!result.data;
  };

  const confirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    setBusyId(`folder-${deletingFolder.id}`);
    await deleteFolder({ data: { id: deletingFolder.id } });
    setBusyId(null);
    setDeletingFolder(null);
  };

  const confirmDeleteBookmark = async () => {
    if (!deletingBookmark) return;
    setBusyId(`bookmark-${deletingBookmark.id}`);
    await deleteBookmark({ data: { id: deletingBookmark.id } });
    setBusyId(null);
    setDeletingBookmark(null);
  };

  const confirmBatchDelete = async () => {
    if (!batchDeleteTarget) return;
    setIsBatchDeleting(true);
    if (batchDeleteTarget === "folders") {
      await deleteFolders({ data: { ids: selectedFolderIds } });
      setSelectedFolderIds([]);
    } else {
      await deleteBookmarks({ data: { ids: selectedBookmarkIds } });
      setSelectedBookmarkIds([]);
    }
    setIsBatchDeleting(false);
    setBatchDeleteTarget(null);
  };

  const batchDeleteCount =
    batchDeleteTarget === "folders"
      ? selectedFolderIds.length
      : selectedBookmarkIds.length;

  if (isPending) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setShowImport(true)}
          className="rounded-none font-mono text-xs uppercase tracking-widest gap-2"
        >
          <FileUp size={14} />
          {m.navigation_admin_import()}
        </Button>
        <Button
          onClick={() => setBookmarkModal({ open: true, editing: null })}
          className="rounded-none bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-widest gap-2"
        >
          <Plus size={14} />
          {m.navigation_admin_add_bookmark()}
        </Button>
      </div>

      {/* Folder chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <FolderChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`${m.navigation_all()} (${bookmarks.length})`}
        />
        <FolderChip
          active={filter === "none"}
          onClick={() => setFilter("none")}
          label={`${m.navigation_uncategorized()} (${
            bookmarks.filter((b) => b.folderId === null).length
          })`}
        />
        {folders.map((folder) => (
          <div key={folder.id} className="flex items-center gap-1">
            <Checkbox
              checked={selectedFolderIds.includes(folder.id)}
              onCheckedChange={() => toggleFolderSelect(folder.id)}
              className="h-3.5 w-3.5"
              aria-label={folder.name}
            />
            <FolderChip
              active={filter === folder.id}
              onClick={() => setFilter(folder.id)}
              label={`${folder.name} (${folder.bookmarkCount})`}
            />
            {busy(`folder-${folder.id}`) ? (
              <Loader2
                size={12}
                className="animate-spin text-muted-foreground ml-1"
              />
            ) : (
              <div className="ml-0.5 flex">
                <button
                  onClick={() =>
                    setFolderModal({ open: true, editing: folder })
                  }
                  className="p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
                  title={m.navigation_admin_edit()}
                >
                  <Pencil size={11} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setDeletingFolder(folder)}
                  className="p-0.5 text-muted-foreground/50 hover:text-red-500 transition-colors"
                  title={m.navigation_admin_delete()}
                >
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFolderModal({ open: true, editing: null })}
          className="rounded-full h-8 gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <FolderPlus size={12} />
          {m.navigation_admin_add_folder()}
        </Button>
        {selectedFolderIds.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBatchDeleteTarget("folders")}
            className="rounded-full h-8 gap-1 font-mono text-xs text-red-600 border-red-400/50 hover:text-red-600 hover:border-red-400"
          >
            <Trash2 size={12} />
            {m.navigation_admin_batch_delete()} ({selectedFolderIds.length})
          </Button>
        )}
      </div>

      {/* Bookmark list header */}
      {visibleBookmarks.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-muted-foreground">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectAllVisible}
              className="h-3.5 w-3.5"
            />
            {m.navigation_admin_select_all()} ({visibleBookmarks.length})
          </label>
          {selectedBookmarkIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchDeleteTarget("bookmarks")}
              className="gap-1 font-mono text-xs text-red-600 border-red-400/50 hover:text-red-600 hover:border-red-400 rounded-none"
            >
              <Trash2 size={12} />
              {m.navigation_admin_batch_delete()} ({selectedBookmarkIds.length})
            </Button>
          )}
        </div>
      )}

      {/* Bookmark list */}
      {visibleBookmarks.length === 0 ? (
        <div className="border border-border/30 py-16 text-center text-sm text-muted-foreground">
          {m.navigation_admin_empty_bookmarks()}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visibleBookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              busy={busy(`bookmark-${bookmark.id}`)}
              selected={selectedBookmarkIds.includes(bookmark.id)}
              onSelect={() => toggleBookmarkSelect(bookmark.id)}
              onEdit={() => setBookmarkModal({ open: true, editing: bookmark })}
              onDelete={() => setDeletingBookmark(bookmark)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <FolderFormModal
        isOpen={folderModal.open}
        onClose={() => setFolderModal({ open: false, editing: null })}
        onSubmit={handleFolderSubmit}
        initialData={folderModal.editing ?? undefined}
      />
      <BookmarkFormModal
        isOpen={bookmarkModal.open}
        onClose={() => setBookmarkModal({ open: false, editing: null })}
        onSubmit={handleBookmarkSubmit}
        initialData={bookmarkModal.editing ?? undefined}
        folders={folders}
        defaultFolderId={filter === "all" || filter === "none" ? null : filter}
        onCreateFolder={handleCreateFolder}
      />
      <ImportBookmarkModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
      />
      <ConfirmationModal
        isOpen={deletingFolder !== null}
        onClose={() => setDeletingFolder(null)}
        onConfirm={confirmDeleteFolder}
        title={m.navigation_admin_confirm_delete_title()}
        message={m.navigation_admin_confirm_delete_desc()}
        confirmLabel={m.navigation_admin_confirm_delete()}
        isDanger
      />
      <ConfirmationModal
        isOpen={deletingBookmark !== null}
        onClose={() => setDeletingBookmark(null)}
        onConfirm={confirmDeleteBookmark}
        title={m.navigation_admin_confirm_delete_title()}
        message={m.navigation_admin_confirm_delete_desc()}
        confirmLabel={m.navigation_admin_confirm_delete()}
        isDanger
      />
      <ConfirmationModal
        isOpen={batchDeleteTarget !== null}
        onClose={() => setBatchDeleteTarget(null)}
        onConfirm={confirmBatchDelete}
        title={m.navigation_admin_batch_delete_confirm_title()}
        message={m.navigation_admin_batch_delete_confirm_desc({
          count: batchDeleteCount,
        })}
        confirmLabel={m.navigation_admin_batch_delete()}
        isDanger
        isLoading={isBatchDeleting}
      />
    </div>
  );
}

function FolderChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 h-8 px-3 rounded-full border text-xs font-mono transition-all",
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/40",
      )}
    >
      {label}
    </button>
  );
}

function BookmarkCard({
  bookmark,
  busy,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  bookmark: Bookmark;
  busy: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const favicon = useFaviconSource(getHostname(bookmark.url));

  return (
    <div
      className={cn(
        "group flex items-center gap-3 border px-3 py-3 transition-colors",
        selected
          ? "border-foreground/60 bg-muted/30"
          : "border-border/30 hover:bg-muted/40",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        className="h-3.5 w-3.5 shrink-0"
        aria-label={bookmark.name}
      />
      <div className="w-8 h-8 rounded-md overflow-hidden border border-border/40 flex items-center justify-center shrink-0">
        {favicon.hasIcon ? (
          <img
            src={favicon.src}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={favicon.onError}
          />
        ) : (
          <span className="text-[9px] font-medium text-muted-foreground">
            {bookmark.name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-medium truncate hover:underline"
        >
          {bookmark.name}
        </a>
        <p className="text-[11px] text-muted-foreground truncate font-mono">
          {getHostname(bookmark.url)}
        </p>
      </div>
      {busy ? (
        <Loader2
          size={14}
          className="animate-spin text-muted-foreground shrink-0"
        />
      ) : (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title={m.navigation_admin_edit()}
          >
            <Pencil size={12} strokeWidth={1.5} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
            title={m.navigation_admin_delete()}
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
