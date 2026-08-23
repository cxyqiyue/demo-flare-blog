import {
  FileUp,
  Folder,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AdminPagination } from "@/components/admin/admin-pagination";
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
import { MaskedName } from "@/features/navigation/components/masked-name";
import {
  useAdminNavigation,
  useAdminNavigationData,
} from "@/features/navigation/hooks/use-navigation";
import {
  useGridPagination,
  NAV_CARD_GAP,
} from "@/features/navigation/hooks/use-grid-pagination";
import type {
  CreateBookmarkFormValues,
  CreateFolderFormValues,
  NavigationPublicData,
} from "@/features/navigation/navigation.schema";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type NavigationFolder = NavigationPublicData["folders"][number];
type Bookmark = NavigationPublicData["bookmarks"][number];

type BatchDeleteTarget = "folders" | "bookmarks";

/** 后台卡片固定宽度（px）：与 w-44 对齐，容纳勾选框 + 图标 + 名称 + 操作 */
const ADMIN_CARD_WIDTH = 176;

/** 后台通用分页推导：页码收敛，避免数据变化后出现空页 */
function resolvePaged<T>(items: T[], page: number, pageSize: number) {
  const effectivePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / effectivePageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  return {
    totalPages,
    currentPage,
    paged: items.slice(
      (currentPage - 1) * effectivePageSize,
      currentPage * effectivePageSize,
    ),
  };
}

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
    editing: NavigationFolder | null;
  }>({ open: false, editing: null });
  const [bookmarkModal, setBookmarkModal] = useState<{
    open: boolean;
    editing: Bookmark | null;
  }>({ open: false, editing: null });
  const [deletingFolder, setDeletingFolder] = useState<NavigationFolder | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(
    null,
  );
  const [batchDeleteTarget, setBatchDeleteTarget] =
    useState<BatchDeleteTarget | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<number[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** 内联快速改名状态：正在改名的书签 id 与草稿值 */
  const [renaming, setRenaming] = useState<{ id: number; value: string } | null>(
    null,
  );

  // 同级内容自动分页：列数按容器宽度自适应，行数按设备档位固定
  const folderGrid = useGridPagination(ADMIN_CARD_WIDTH, NAV_CARD_GAP);
  const bookmarkGrid = useGridPagination(ADMIN_CARD_WIDTH, NAV_CARD_GAP);
  const [folderPage, setFolderPage] = useState(1);
  const [bookmarkPage, setBookmarkPage] = useState(1);

  const folders = data?.folders ?? [];
  const bookmarks = data?.bookmarks ?? [];

  const visibleBookmarks = bookmarks
    .filter((bookmark) => {
      if (filter === "all") return true;
      if (filter === "none") return bookmark.folderId === null;
      return bookmark.folderId === filter;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const folderPaging = resolvePaged(folders, folderPage, folderGrid.pageSize);
  const bookmarkPaging = resolvePaged(
    visibleBookmarks,
    bookmarkPage,
    bookmarkGrid.pageSize,
  );

  // 当前页可见书签：全选仅作用于当前页
  const visibleIds = bookmarkPaging.paged.map((b) => b.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedBookmarkIds.includes(id));

  const busy = (key: string) => busyId === key;

  const applyFilter = (next: number | "all" | "none") => {
    setFilter(next);
    setBookmarkPage(1);
  };

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

  const startRename = (bookmark: Bookmark) => {
    setRenaming({ id: bookmark.id, value: bookmark.name });
  };

  const commitRename = async () => {
    if (!renaming) return;
    const target = bookmarks.find((b) => b.id === renaming.id);
    const next = renaming.value.trim();
    setRenaming(null);
    if (!target || !next || next === target.name) return;
    await updateBookmark({ data: { id: target.id, name: next } });
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

      {/* 文件夹卡片：左侧文件夹图标 + 右侧分类名，同级数量自动分页 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <span>
              {m.navigation_admin_section_folders()} ({folders.length})
            </span>
            {selectedFolderIds.length > 0 && (
              <span className="text-red-600">
                {m.navigation_admin_selected_count({
                  count: selectedFolderIds.length,
                })}
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
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
        </div>

        {folders.length === 0 ? (
          <p className="text-xs font-mono text-muted-foreground/50 py-2">
            {m.navigation_admin_empty_folders()}
          </p>
        ) : (
          <>
            <div
              ref={folderGrid.containerRef}
              className="flex flex-wrap content-start gap-2"
            >
              {folderPaging.paged.map((folder) => (
                <AdminFolderCard
                  key={folder.id}
                  folder={folder}
                  busy={busy(`folder-${folder.id}`)}
                  selected={selectedFolderIds.includes(folder.id)}
                  active={filter === folder.id}
                  onSelectToggle={() => toggleFolderSelect(folder.id)}
                  onOpen={() => applyFilter(folder.id)}
                  onEdit={() => setFolderModal({ open: true, editing: folder })}
                  onDelete={() => setDeletingFolder(folder)}
                />
              ))}
            </div>
            <AdminPagination
              currentPage={folderPaging.currentPage}
              totalPages={folderPaging.totalPages}
              totalItems={folders.length}
              itemsPerPage={folderGrid.pageSize}
              currentPageItemCount={folderPaging.paged.length}
              onPageChange={setFolderPage}
            />
          </>
        )}
      </div>

      {/* 书签区：筛选 + 网格分页 */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/20">
        <FilterChip
          active={filter === "all"}
          onClick={() => applyFilter("all")}
          label={`${m.navigation_all()} (${bookmarks.length})`}
        />
        <FilterChip
          active={filter === "none"}
          onClick={() => applyFilter("none")}
          label={`${m.navigation_uncategorized()} (${
            bookmarks.filter((b) => b.folderId === null).length
          })`}
        />
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
            {m.navigation_admin_select_all()} ({visibleIds.length})
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

      {/* Bookmark grid：固定尺寸卡片，同级数量自动分页；点击名称内联快速改名 */}
      {visibleBookmarks.length === 0 ? (
        <div className="border border-border/30 py-16 text-center text-sm text-muted-foreground">
          {m.navigation_admin_empty_bookmarks()}
        </div>
      ) : (
        <>
          <div
            ref={bookmarkGrid.containerRef}
            className="flex flex-wrap content-start gap-2"
          >
            {bookmarkPaging.paged.map((bookmark) => (
              <AdminBookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                busy={busy(`bookmark-${bookmark.id}`)}
                selected={selectedBookmarkIds.includes(bookmark.id)}
                renaming={
                  renaming?.id === bookmark.id ? renaming.value : undefined
                }
                onSelect={() => toggleBookmarkSelect(bookmark.id)}
                onRenameStart={() => startRename(bookmark)}
                onRenameChange={(value) =>
                  setRenaming({ id: bookmark.id, value })
                }
                onRenameCommit={commitRename}
                onRenameCancel={() => setRenaming(null)}
                onEdit={() =>
                  setBookmarkModal({ open: true, editing: bookmark })
                }
                onDelete={() => setDeletingBookmark(bookmark)}
              />
            ))}
          </div>
          <AdminPagination
            currentPage={bookmarkPaging.currentPage}
            totalPages={bookmarkPaging.totalPages}
            totalItems={visibleBookmarks.length}
            itemsPerPage={bookmarkGrid.pageSize}
            currentPageItemCount={bookmarkPaging.paged.length}
            onPageChange={setBookmarkPage}
          />
        </>
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

function FilterChip({
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

/** 卡片右上角悬停操作层（渐变遮罩盖住计数/名称尾部） */
function CardHoverActions({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-y-0 right-0 hidden group-hover:flex items-center gap-0.5 pr-1.5 pl-8 bg-gradient-to-l from-background via-background/95 to-transparent">
      {children}
    </div>
  );
}

interface AdminFolderCardProps {
  folder: NavigationFolder;
  busy: boolean;
  selected: boolean;
  active: boolean;
  onSelectToggle: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** 后台文件夹卡片：勾选框 + 左侧图标 + 右侧分类名（超出虚化），点击卡片筛选该书签 */
function AdminFolderCard({
  folder,
  busy,
  selected,
  active,
  onSelectToggle,
  onOpen,
  onEdit,
  onDelete,
}: AdminFolderCardProps) {
  return (
    <div
      className={cn(
        "group relative flex h-11 w-44 items-center gap-1.5 rounded-lg border px-2 transition-colors",
        selected || active
          ? "border-foreground/60 bg-muted/30"
          : "border-border/30 hover:bg-muted/40",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onSelectToggle}
        className="h-3.5 w-3.5 shrink-0"
        aria-label={folder.name}
      />
      <button
        type="button"
        onClick={onOpen}
        title={folder.name}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="w-6 h-6 rounded-md bg-muted/40 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground">
          <Folder size={13} strokeWidth={1.75} />
        </span>
        <MaskedName className="text-xs font-medium text-foreground/80">
          {folder.name}
        </MaskedName>
        <span className="ml-auto shrink-0 pr-0.5 text-[10px] font-mono text-muted-foreground/70 group-hover:opacity-0 transition-opacity">
          {folder.bookmarkCount}
        </span>
      </button>
      {busy ? (
        <Loader2
          size={13}
          className="animate-spin text-muted-foreground absolute right-2"
        />
      ) : (
        <CardHoverActions>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title={m.navigation_admin_edit()}
          >
            <Pencil size={12} strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
            title={m.navigation_admin_delete()}
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        </CardHoverActions>
      )}
    </div>
  );
}

interface AdminBookmarkCardProps {
  bookmark: Bookmark;
  busy: boolean;
  selected: boolean;
  /** 有值表示该卡片处于内联改名态（值为输入框草稿） */
  renaming?: string;
  onSelect: () => void;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * 后台书签卡片：勾选框 + 左侧网站图标 + 右侧书签名（超出虚化）。
 * 点击名称进入内联快速改名（回车/失焦保存，Esc 取消）。
 */
function AdminBookmarkCard({
  bookmark,
  busy,
  selected,
  renaming,
  onSelect,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onEdit,
  onDelete,
}: AdminBookmarkCardProps) {
  const favicon = useFaviconSource(getHostname(bookmark.url));

  return (
    <div
      className={cn(
        "group relative flex h-11 w-44 items-center gap-1.5 rounded-lg border px-2 transition-colors",
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
      <span className="w-6 h-6 rounded-md overflow-hidden bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
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
      </span>
      {renaming !== undefined ? (
        <input
          autoFocus
          value={renaming}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onRenameCancel();
            }
          }}
          onBlur={onRenameCommit}
          className="min-w-0 flex-1 h-7 rounded border border-border/60 bg-background px-1.5 text-xs text-foreground outline-none focus:border-foreground/60 focus:ring-1 focus:ring-foreground/10"
          aria-label={m.navigation_admin_rename()}
        />
      ) : (
        <button
          type="button"
          onClick={onRenameStart}
          title={`${bookmark.name} · ${getHostname(bookmark.url)}`}
          className="flex min-w-0 flex-1 text-left"
        >
          <MaskedName className="text-xs font-medium text-foreground/80 hover:text-foreground transition-colors">
            {bookmark.name}
          </MaskedName>
        </button>
      )}
      {busy ? (
        <Loader2
          size={13}
          className="animate-spin text-muted-foreground absolute right-2"
        />
      ) : (
        renaming === undefined && (
          <CardHoverActions>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title={m.navigation_admin_edit()}
            >
              <Pencil size={12} strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
              title={m.navigation_admin_delete()}
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </button>
          </CardHoverActions>
        )
      )}
    </div>
  );
}
