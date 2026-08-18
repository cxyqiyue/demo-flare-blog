import {
  Check,
  Film,
  Folder,
  Image as ImageIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { getOptimizedImageUrl } from "@/features/media/utils/media.utils";
import { formatBytes } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { useLongPress } from "../hooks/use-long-press";
import type { MediaDirectoryFile, MediaFolder } from "../types";

interface MediaGridProps {
  media: Array<MediaDirectoryFile>;
  folders: Array<MediaFolder>;
  selectedIds: Set<string>;
  onToggleSelect: (key: string) => void;
  onPreview: (asset: MediaDirectoryFile) => void;
  onOpenFolder: (folder: string) => void;
  onRenameFolder?: (folder: MediaFolder) => void;
  onDeleteFolder?: (folder: MediaFolder) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  linkedMediaIds?: Set<string>;
  onRefetch?: () => void;
}

const FolderCard = memo(
  ({
    folder,
    isSelected,
    onOpen,
    onToggleSelect,
    onRename,
    onDelete,
    selectionModeActive,
  }: {
    folder: MediaFolder;
    isSelected: boolean;
    onOpen: (folder: string) => void;
    onToggleSelect: (key: string) => void;
    onRename?: (folder: MediaFolder) => void;
    onDelete?: (folder: MediaFolder) => void;
    selectionModeActive: boolean;
  }) => {
    const handleStandardClick = () => {
      if (selectionModeActive) {
        onToggleSelect(folder.key);
      } else {
        onOpen(folder.key);
      }
    };

    const handleLongPress = () => {
      onToggleSelect(folder.key);
    };

    const longPressHandlers = useLongPress(
      handleLongPress,
      handleStandardClick,
      { delay: 500 },
    );

    return (
      <div
        {...longPressHandlers}
        className={`group relative flex flex-col cursor-pointer transition-all duration-300 touch-manipulation select-none overflow-hidden rounded-none border ${
          isSelected
            ? "border-foreground bg-accent/20"
            : "border-border/50 hover:border-foreground/50"
        }`}
      >
        {/* Selection Indicator */}
        <div
          className={`absolute top-0 left-0 z-30 p-2 transition-all duration-200 ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(folder.key);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div
            className={`w-4 h-4 border flex items-center justify-center transition-colors ${
              isSelected
                ? "bg-foreground border-foreground"
                : "bg-background/80 backdrop-blur-sm border-muted-foreground/50 hover:border-foreground"
            }`}
          >
            {isSelected && (
              <Check size={10} className="text-background" strokeWidth={3} />
            )}
          </div>
        </div>

        {/* Folder Actions */}
        <div className="absolute top-0 right-0 z-20 flex gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRename && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRename(folder);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center bg-background/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil size={11} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(folder);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center bg-background/80 backdrop-blur-sm border border-border/50 text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {/* Icon */}
        <div className="aspect-square relative overflow-hidden bg-muted/20 border-b border-border/30 flex items-center justify-center">
          <Folder
            size={40}
            strokeWidth={1}
            className={
              isSelected ? "text-foreground" : "text-muted-foreground/70"
            }
          />
        </div>

        {/* Info */}
        <div className="p-3 space-y-1.5 bg-background">
          <div className="text-[10px] font-mono font-medium truncate text-foreground">
            {folder.name}
          </div>
          <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono tracking-wider uppercase border-t border-border/30 pt-1.5">
            <span>{m.media_grid_folder()}</span>
          </div>
        </div>
      </div>
    );
  },
);

FolderCard.displayName = "FolderCard";

const MediaCard = memo(
  ({
    asset,
    isSelected,
    isLinked,
    isImage,
    onToggleSelect,
    onPreview,
    selectionModeActive,
  }: {
    asset: MediaDirectoryFile;
    isSelected: boolean;
    isLinked: boolean;
    isImage: boolean;
    onToggleSelect: (key: string) => void;
    onPreview: (asset: MediaDirectoryFile) => void;
    selectionModeActive: boolean;
  }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const thumbnailUrl = getOptimizedImageUrl(asset.key);

    const handleStandardClick = () => {
      if (selectionModeActive) {
        onToggleSelect(asset.key);
      } else {
        onPreview(asset);
      }
    };

    const handleLongPress = () => {
      onToggleSelect(asset.key);
    };

    const longPressHandlers = useLongPress(
      handleLongPress,
      handleStandardClick,
      {
        delay: 500,
      },
    );

    return (
      <div
        {...longPressHandlers}
        className={`group relative flex flex-col cursor-pointer transition-all duration-300 touch-manipulation select-none overflow-hidden rounded-none border ${
          isSelected
            ? "border-foreground bg-accent/20"
            : isLinked
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-border/50 hover:border-foreground/50"
        }`}
      >
        {/* Selection Indicator (Top Left) */}
        <div
          className={`absolute top-0 left-0 z-30 p-2 transition-all duration-200 ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(asset.key);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div
            className={`w-4 h-4 border flex items-center justify-center transition-colors ${
              isSelected
                ? "bg-foreground border-foreground"
                : "bg-background/80 backdrop-blur-sm border-muted-foreground/50 hover:border-foreground"
            }`}
          >
            {isSelected && (
              <Check size={10} className="text-background" strokeWidth={3} />
            )}
          </div>
        </div>

        {/* Linked Indicator */}
        {isLinked && (
          <div className="absolute top-0 right-0 z-20 px-2 py-1 bg-emerald-500 text-white text-[9px] font-mono tracking-wider uppercase">
            {m.media_grid_linked()}
          </div>
        )}

        {/* Preview */}
        <div className="aspect-square relative overflow-hidden bg-muted/20 border-b border-border/30">
          {isImage ? (
            <>
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/20 animate-pulse">
                  <ImageIcon size={20} className="text-muted-foreground/30" />
                </div>
              )}
              <img
                src={thumbnailUrl}
                alt={asset.fileName}
                className={`w-full h-full object-cover transition-all duration-500 ${
                  isLoaded ? "opacity-100" : "opacity-0"
                } ${isSelected ? "opacity-50" : ""}`}
                onLoad={() => setIsLoaded(true)}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Film size={24} strokeWidth={1} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-1.5 bg-background">
          <div className="text-[10px] font-mono font-medium truncate text-foreground group-hover:text-foreground transition-colors">
            {asset.fileName}
          </div>
          <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono tracking-wider uppercase border-t border-border/30 pt-1.5">
            <span>{formatBytes(asset.sizeInBytes)}</span>
            <span>{asset.mimeType.split("/")[1]}</span>
          </div>
        </div>
      </div>
    );
  },
);

MediaCard.displayName = "MediaCard";

export function MediaGrid({
  media,
  folders,
  selectedIds,
  onToggleSelect,
  onPreview,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onLoadMore,
  hasMore,
  isLoadingMore,
  linkedMediaIds,
  onRefetch,
}: MediaGridProps) {
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          onLoadMore
        ) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  const selectionModeActive = selectedIds.size > 0;

  if (media.length === 0 && folders.length === 0) {
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
    <div className="space-y-12">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
        {folders.map((folder) => {
          const isSelected = selectedIds.has(folder.key);
          return (
            <FolderCard
              key={folder.key}
              folder={folder}
              isSelected={isSelected}
              onOpen={onOpenFolder}
              onToggleSelect={onToggleSelect}
              onRename={onRenameFolder}
              onDelete={onDeleteFolder}
              selectionModeActive={selectionModeActive}
            />
          );
        })}

        {media.map((asset) => {
          const isSelected = selectedIds.has(asset.key);
          const isLinked = linkedMediaIds?.has(asset.key) ?? false;
          const isImage = asset.mimeType.startsWith("image/");

          return (
            <MediaCard
              key={asset.key}
              asset={asset}
              isSelected={isSelected}
              isLinked={isLinked}
              isImage={isImage}
              onToggleSelect={onToggleSelect}
              onPreview={onPreview}
              selectionModeActive={selectionModeActive}
            />
          );
        })}
      </div>

      {/* Loading / Sentinel */}
      <div
        ref={observerTarget}
        className="py-12 flex flex-col items-center justify-center gap-4"
      >
        {isLoadingMore ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-none border-2 border-t-foreground border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
              {m.media_grid_loading()}
            </span>
          </div>
        ) : !hasMore && (media.length > 0 || folders.length > 0) ? (
          <div className="flex items-center gap-2 opacity-50">
            <div className="h-px w-12 bg-border" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              {m.media_grid_end()}
            </span>
            <div className="h-px w-12 bg-border" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
