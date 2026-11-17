import { Film, Folder, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getOptimizedImageUrl } from "@/features/media/utils/media.utils";
import { formatBytes } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { MediaDirectoryFile, MediaFolder } from "../types";

interface FlareMediaListProps {
  view: "grid" | "table";
  media: MediaDirectoryFile[];
  folders: MediaFolder[];
  selectedIds: Set<string>;
  onToggleSelect: (key: string) => void;
  onPreview: (asset: MediaDirectoryFile) => void;
  onOpenFolder: (key: string) => void;
  onRenameFolder?: (folder: MediaFolder) => void;
  onDeleteFolder?: (folder: MediaFolder) => void;
  onRenameFile?: (asset: MediaDirectoryFile) => void;
  onDeleteFile?: (asset: MediaDirectoryFile) => void;
  linkedMediaIds?: Set<string>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onRefetch?: () => void;
}

export function FlareMediaList(props: FlareMediaListProps) {
  const grid = props.view === "grid";
  if (!props.media.length && !props.folders.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        <ImageIcon size={30} />
        <p>{m.media_grid_empty()}</p>
        {props.onRefetch ? (
          <Button type="button" variant="outline" onClick={props.onRefetch}>
            {m.media_grid_refresh()}
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div
        className={
          grid
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
            : "space-y-3"
        }
      >
        {props.folders.map((folder) => (
          <article
            key={folder.key}
            className="min-w-0 rounded-xl border border-border/60 bg-card p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <Checkbox
                checked={props.selectedIds.has(folder.key)}
                onCheckedChange={() => props.onToggleSelect(folder.key)}
                aria-label={folder.name}
              />
              <span className="text-xs text-muted-foreground">
                {m.media_grid_folder()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => props.onOpenFolder(folder.key)}
              className={`flex w-full min-w-0 gap-3 rounded-lg text-left hover:text-primary ${grid ? "flex-col items-center bg-muted/30 p-4" : "items-center p-2"}`}
            >
              <Folder size={grid ? 36 : 22} className="shrink-0 text-primary" />
              <span className="w-full break-words text-sm font-medium">
                {folder.name}
              </span>
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              {props.onRenameFolder ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => props.onRenameFolder?.(folder)}
                >
                  {m.media_folder_rename_btn()}
                </Button>
              ) : null}
              {props.onDeleteFolder ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => props.onDeleteFolder?.(folder)}
                >
                  {m.media_folder_delete_btn()}
                </Button>
              ) : null}
            </div>
          </article>
        ))}
        {props.media.map((asset) => (
          <article
            key={asset.key}
            className={`min-w-0 rounded-xl border bg-card p-3 ${props.selectedIds.has(asset.key) ? "border-primary" : "border-border/60"}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Checkbox
                checked={props.selectedIds.has(asset.key)}
                onCheckedChange={() => props.onToggleSelect(asset.key)}
                aria-label={asset.fileName}
              />
              {(props.linkedMediaIds?.has(asset.key) ?? asset.isLinked) ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {m.media_grid_linked()}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => props.onPreview(asset)}
              className={`flex w-full min-w-0 gap-3 rounded-lg text-left hover:text-primary ${grid ? "flex-col" : "items-center"}`}
            >
              <span
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30 ${grid ? "aspect-square w-full" : "size-12"}`}
              >
                {asset.mimeType.startsWith("image/") ? (
                  <img
                    src={getOptimizedImageUrl(asset.key)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <Film size={28} className="text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block break-all text-sm font-medium">
                  {asset.fileName}
                </span>
                <span className="block break-all text-xs text-muted-foreground">
                  {formatBytes(asset.sizeInBytes)} · {asset.mimeType}
                </span>
              </span>
            </button>
            {props.onRenameFile || props.onDeleteFile ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {props.onRenameFile ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => props.onRenameFile?.(asset)}
                  >
                    {m.media_preview_btn_rename()}
                  </Button>
                ) : null}
                {props.onDeleteFile ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => props.onDeleteFile?.(asset)}
                  >
                    {m.media_preview_btn_delete()}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {props.hasMore && props.onLoadMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={props.isLoadingMore}
            onClick={props.onLoadMore}
          >
            {props.isLoadingMore ? m.media_grid_loading() : m.media_load_more()}
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {m.media_grid_end()}
        </p>
      )}
    </div>
  );
}
