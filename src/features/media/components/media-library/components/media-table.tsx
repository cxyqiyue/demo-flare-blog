import {
  Check,
  Film,
  Folder,
  Image as ImageIcon,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react";
import { getOptimizedImageUrl } from "@/features/media/utils/media.utils";
import { formatBytes } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { MediaDirectoryFile, MediaFolder } from "../types";

interface MediaTableProps {
  media: Array<MediaDirectoryFile>;
  folders: Array<MediaFolder>;
  selectedIds: Set<string>;
  onToggleSelect: (key: string) => void;
  onPreview: (asset: MediaDirectoryFile) => void;
  onOpenFolder: (folder: string) => void;
  onRenameFolder?: (folder: MediaFolder) => void;
  onDeleteFolder?: (folder: MediaFolder) => void;
  onRenameFile?: (asset: MediaDirectoryFile) => void;
  onDeleteFile?: (asset: MediaDirectoryFile) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onRefetch?: () => void;
}

const FolderRow = ({
  folder,
  isSelected,
  onToggleSelect,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: MediaFolder;
  isSelected: boolean;
  onToggleSelect: (key: string) => void;
  onOpen: (folder: string) => void;
  onRename?: (folder: MediaFolder) => void;
  onDelete?: (folder: MediaFolder) => void;
}) => {
  return (
    <div className="group flex items-center gap-3 border border-border/50 hover:border-foreground/50 transition-all bg-muted/5 px-3 py-2.5">
      <button
        type="button"
        onClick={() => onToggleSelect(folder.key)}
        className={`shrink-0 w-4 h-4 border flex items-center justify-center transition-colors ${
          isSelected
            ? "bg-foreground border-foreground"
            : "border-muted-foreground/50 hover:border-foreground"
        }`}
      >
        {isSelected && (
          <Check size={10} className="text-background" strokeWidth={3} />
        )}
      </button>
      <button
        type="button"
        onClick={() => onOpen(folder.key)}
        className="flex items-center gap-2 min-w-0 flex-1 text-left"
      >
        <Folder
          size={16}
          strokeWidth={1.5}
          className={
            isSelected ? "text-foreground" : "text-muted-foreground/70"
          }
        />
        <span className="truncate text-xs font-mono font-medium text-foreground">
          {folder.name}
        </span>
      </button>
      <span className="hidden sm:block text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {m.media_grid_folder()}
      </span>
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {onRename && (
          <button
            type="button"
            onClick={() => onRename(folder)}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={m.media_folder_rename_btn()}
          >
            <Pencil size={12} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(folder)}
            className="w-7 h-7 flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
            title={m.media_folder_delete_btn()}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

const FileRow = ({
  asset,
  isSelected,
  isLinked,
  onToggleSelect,
  onPreview,
  onRename,
  onDelete,
}: {
  asset: MediaDirectoryFile;
  isSelected: boolean;
  isLinked: boolean;
  onToggleSelect: (key: string) => void;
  onPreview: (asset: MediaDirectoryFile) => void;
  onRename?: (asset: MediaDirectoryFile) => void;
  onDelete?: (asset: MediaDirectoryFile) => void;
}) => {
  const isImage = asset.mimeType.startsWith("image/");
  const thumbnailUrl = getOptimizedImageUrl(asset.key);

  return (
    <div className="flex items-center gap-3 border border-border/50 hover:border-foreground/50 transition-all bg-background px-3 py-2.5">
      <button
        type="button"
        onClick={() => onToggleSelect(asset.key)}
        className={`shrink-0 w-4 h-4 border flex items-center justify-center transition-colors ${
          isSelected
            ? "bg-foreground border-foreground"
            : isLinked
              ? "border-emerald-500/60"
              : "border-muted-foreground/50 hover:border-foreground"
        }`}
      >
        {isSelected && (
          <Check size={10} className="text-background" strokeWidth={3} />
        )}
      </button>
      <button
        type="button"
        onClick={() => onPreview(asset)}
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
      >
        <div className="shrink-0 w-9 h-9 overflow-hidden bg-muted/20 border border-border/30 flex items-center justify-center">
          {isImage ? (
            <img
              src={thumbnailUrl}
              alt={asset.fileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <Film size={14} className="text-muted-foreground" />
          )}
        </div>
        <span className="truncate text-xs font-mono font-medium text-foreground">
          {asset.fileName}
        </span>
      </button>
      <span className="hidden md:inline-block shrink-0 w-16 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {asset.mimeType.split("/")[1]}
      </span>
      <span className="hidden lg:inline-block shrink-0 w-20 text-right text-[10px] font-mono text-muted-foreground">
        {formatBytes(asset.sizeInBytes)}
      </span>
      <span className="hidden sm:inline-block shrink-0 w-16 text-right">
        {isLinked ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-emerald-600">
            <Link2 size={10} /> {m.media_grid_linked()}
          </span>
        ) : (
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">
            -
          </span>
        )}
      </span>
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {onRename && (
          <button
            type="button"
            onClick={() => onRename(asset)}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={m.media_preview_btn_rename()}
          >
            <Pencil size={12} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(asset)}
            className="w-7 h-7 flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
            title={m.media_preview_btn_delete()}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

export function MediaTable({
  media,
  folders,
  selectedIds,
  onToggleSelect,
  onPreview,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onRenameFile,
  onDeleteFile,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onRefetch,
}: MediaTableProps) {
  const hasContent = media.length > 0 || folders.length > 0;

  if (!hasContent) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-muted-foreground gap-4 border border-dashed border-border/30 bg-muted/5">
        <ImageIcon size={32} strokeWidth={1} className="opacity-20" />
        <div className="text-center font-mono text-xs">
          <span className="uppercase tracking-widest block mb-2">
            {m.media_grid_empty()}
          </span>
          {onRefetch && (
            <button
              onClick={onRefetch}
              className="text-[10px] uppercase tracking-widest font-bold hover:underline opacity-50 hover:opacity-100"
            >
              [ {m.media_grid_refresh()} ]
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Folders */}
      {folders.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {m.media_section_folders({ count: folders.length })}
          </div>
          <div className="space-y-1.5">
            {folders.map((folder) => (
              <FolderRow
                key={folder.key}
                folder={folder}
                isSelected={selectedIds.has(folder.key)}
                onToggleSelect={onToggleSelect}
                onOpen={onOpenFolder}
                onRename={onRenameFolder}
                onDelete={onDeleteFolder}
              />
            ))}
          </div>
        </div>
      )}

      {/* Files - desktop table / mobile stacked cards */}
      {media.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            {m.media_section_files({ count: media.length })}
          </div>

          {/* Desktop table header */}
          <div className="hidden md:flex items-center gap-3 px-3 pb-2 border-b border-border/30">
            <div className="w-4 shrink-0" />
            <div className="flex-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {m.media_table_col_name()}
            </div>
            <div className="shrink-0 w-16 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {m.media_table_col_type()}
            </div>
            <div className="hidden lg:block shrink-0 w-20 text-right text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {m.media_table_col_size()}
            </div>
            <div className="hidden sm:block shrink-0 w-16 text-right text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {m.media_table_col_usage()}
            </div>
            <div className="w-16 shrink-0" />
          </div>

          <div className="space-y-1.5">
            {media.map((asset) => {
              const isSelected = selectedIds.has(asset.key);
              return (
                <FileRow
                  key={asset.key}
                  asset={asset}
                  isSelected={isSelected}
                  isLinked={asset.isLinked}
                  onToggleSelect={onToggleSelect}
                  onPreview={onPreview}
                  onRename={onRenameFile}
                  onDelete={onDeleteFile}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Loading / End */}
      <div className="py-8 flex flex-col items-center justify-center gap-4">
        {isLoadingMore ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-none border-2 border-t-foreground border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
              {m.media_grid_loading()}
            </span>
          </div>
        ) : !hasMore ? (
          <div className="flex items-center gap-2 opacity-50">
            <div className="h-px w-12 bg-border" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {m.media_grid_end()}
            </span>
            <div className="h-px w-12 bg-border" />
          </div>
        ) : (
          onLoadMore && (
            <button
              type="button"
              onClick={onLoadMore}
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              [ {m.media_load_more()} ]
            </button>
          )
        )}
      </div>
    </div>
  );
}
