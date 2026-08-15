import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createMediaFolderFn,
  deleteImageFn,
  deleteMediaFoldersFn,
  getMediaDirectoryFn,
  renameMediaFolderFn,
  updateMediaNameFn,
} from "@/features/media/api/media.api";
import {
  linkedMediaKeysQuery,
  MEDIA_KEYS,
  totalMediaSizeQuery,
} from "@/features/media/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { m } from "@/paraglide/messages";

const isFolderKey = (key: string) => key.endsWith("/");

export function useMediaLibrary() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/admin/media/" });
  const { search, unused, folder, view } = useSearch({ from: "/admin/media/" });

  const currentFolder = folder ?? "";
  const currentView = view ?? "grid";

  // Search Param Handlers
  const setSearchQuery = (term: string) => {
    navigate({
      search: { search: term, unused: unused ?? false, folder, view: currentView },
      replace: true,
    });
  };

  const setUnusedOnly = (val: boolean) => {
    navigate({
      search: { search: search ?? "", unused: val, folder, view: currentView },
    });
  };

  const setFolder = (nextFolder: string) => {
    navigate({
      search: {
        search: search ?? "",
        unused: unused ?? false,
        folder: nextFolder,
        view: currentView,
      },
    });
  };

  const setView = (nextView: "grid" | "table") => {
    navigate({
      search: {
        search: search ?? "",
        unused: unused ?? false,
        folder,
        view: nextView,
      },
    });
  };

  const debouncedSearch = useDebounce(search ?? "", 300);

  // Selection & Deletion State (key 作为唯一标识；文件夹 key 以 `/` 结尾)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [deleteTarget, setDeleteTarget] = useState<Array<string> | null>(null);
  const [deletePreview, setDeletePreview] = useState<{
    folders: number;
    files: number;
  } | null>(null);

  // Infinite Query for the current directory (R2 cursor based)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery({
    queryKey: MEDIA_KEYS.dir(currentFolder, debouncedSearch, unused ?? false),
    queryFn: ({ pageParam }) =>
      getMediaDirectoryFn({
        data: {
          folder: currentFolder || undefined,
          cursor: pageParam ?? undefined,
          search: debouncedSearch || undefined,
          unusedOnly: unused || undefined,
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
  });

  const mediaItems = useMemo(
    () =>
      (data?.pages.flatMap((page) => page.files) ?? []).map((file) => ({
        ...file,
        fileName: file.name,
      })),
    [data],
  );
  const folders = useMemo(
    () => data?.pages.flatMap((page) => page.folders) ?? [],
    [data],
  );

  // Get all visible media keys for linked check
  const mediaKeys = useMemo(
    () => mediaItems.map((item) => item.key),
    [mediaItems],
  );

  const { data: linkedKeysData } = useQuery({
    ...linkedMediaKeysQuery(mediaKeys),
    enabled: mediaKeys.length > 0,
  });

  const { data: totalMediaSize } = useQuery(totalMediaSizeQuery);

  const linkedMediaIds = useMemo(() => {
    return new Set<string>(linkedKeysData ?? []);
  }, [linkedKeysData]);

  // Breadcrumbs for the current folder
  const breadcrumbs = useMemo(() => {
    if (!currentFolder) return [] as Array<{ label: string; path: string }>;
    const segments = currentFolder.split("/").filter(Boolean);
    const crumbs: Array<{ label: string; path: string }> = [];
    let acc = "";
    for (const segment of segments) {
      acc = acc ? `${acc}/${segment}` : segment;
      crumbs.push({ label: segment, path: acc });
    }
    return crumbs;
  }, [currentFolder]);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedKeys(new Set());
    setDeleteTarget(null);
  }, [debouncedSearch, unused, currentFolder]);

  // ---- Folder operations ----
  const createFolder = useMutation({
    mutationFn: (name: string) =>
      createMediaFolderFn({ data: { name, parent: currentFolder } }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.media_toast_folder_create_fail(), {
          description: m.media_toast_folder_create_fail_desc(),
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      toast.success(m.media_toast_folder_create_success(), {
        description: m.media_toast_folder_create_success_desc({
          name: result.data.name,
        }),
      });
    },
  });

  const renameFolder = useMutation({
    mutationFn: (payload: { key: string; name: string }) =>
      renameMediaFolderFn({ data: payload }),
    onSuccess: (result, variables) => {
      if (result.error) {
        toast.error(m.media_toast_folder_rename_fail(), {
          description: m.media_toast_folder_rename_fail_desc(),
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      toast.success(m.media_toast_folder_rename_success(), {
        description: m.media_toast_folder_rename_success_desc({
          name: variables.name,
        }),
      });
    },
  });

  // ---- Delete ----
  const deleteMutation = useMutation({
    mutationFn: async (keys: Array<string>) => {
      const folderKeys = keys.filter(isFolderKey);
      const fileKeys = keys.filter((k) => !isFolderKey(k));
      const deletedFiles: Array<string> = [];

      for (const key of fileKeys) {
        const result = await deleteImageFn({ data: { key } });
        if (result.error) {
          return {
            deletedFiles,
            deletedFolders: 0,
            skippedFiles: 0,
            error: result.error,
          };
        }
        deletedFiles.push(key);
      }

      let deletedFolders = 0;
      let skippedFiles = 0;
      if (folderKeys.length > 0) {
        const result = (await deleteMediaFoldersFn({
          data: { keys: folderKeys },
        })) as unknown as {
          data: { deletedFolders: number; deletedFiles: number; skippedFiles: number };
          error: { reason: string } | null;
        };
        if (result.error) {
          return {
            deletedFiles,
            deletedFolders,
            skippedFiles,
            error: result.error,
          };
        }
        deletedFolders = result.data.deletedFolders;
        skippedFiles = result.data.skippedFiles;
      }

      return {
        deletedFiles,
        deletedFolders,
        skippedFiles,
        error: null,
      };
    },
    onSuccess: (result) => {
      const totalDeleted =
        result.deletedFiles.length +
        (result.deletedFolders > 0 ? result.deletedFolders : 0);

      if (totalDeleted > 0) {
        queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          result.deletedFiles.forEach((key) => next.delete(key));
          return next;
        });
      }

      if (result.error) {
        if (totalDeleted > 0) {
          toast.warning(m.media_toast_partial_delete(), {
            description: m.media_toast_partial_delete_desc({
              count: totalDeleted,
            }),
          });
        } else {
          toast.warning(m.media_toast_delete_fail(), {
            description: m.media_toast_delete_fail_desc(),
          });
        }
        return;
      }

      toast.success(m.media_toast_delete_success(), {
        description: m.media_toast_delete_success_desc({
          count: totalDeleted,
        }),
      });
      if (result.skippedFiles > 0) {
        toast.warning(m.media_toast_folder_delete_skipped(), {
          description: m.media_toast_folder_delete_skipped_desc({
            count: result.skippedFiles,
          }),
        });
      }
    },
    onSettled: () => {
      setDeleteTarget(null);
      setDeletePreview(null);
    },
  });

  // Update name mutation
  const updateAsset = useMutation({
    mutationFn: (payload: Parameters<typeof updateMediaNameFn>[0]) =>
      updateMediaNameFn(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      toast.success(m.media_toast_metadata_updated(), {
        description: m.media_toast_metadata_updated_desc(),
      });
    },
  });

  // Load more handler
  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  // Selection handlers
  const toggleSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allKeys = [
      ...folders.map((f) => f.key),
      ...mediaItems.map((item) => item.key),
    ];
    if (selectedKeys.size === allKeys.length && allKeys.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(allKeys));
    }
  };

  // Request delete - validate against linked files, then show confirmation
  const requestDelete = (keys: Array<string>) => {
    const blockedKeys = keys.filter(
      (key) => !isFolderKey(key) && linkedMediaIds.has(key),
    );
    const allowedKeys = keys.filter(
      (key) => isFolderKey(key) || !linkedMediaIds.has(key),
    );

    if (blockedKeys.length > 0) {
      toast.warning(m.media_toast_protected_delete(), {
        description: m.media_toast_protected_delete_desc({
          count: blockedKeys.length,
        }),
      });
    }

    if (allowedKeys.length > 0) {
      setDeleteTarget(allowedKeys);
      setDeletePreview({
        folders: allowedKeys.filter(isFolderKey).length,
        files: allowedKeys.filter((k) => !isFolderKey(k)).length,
      });
    }

    return allowedKeys;
  };

  // Confirm delete
  const confirmDelete = (keys?: Array<string>) => {
    const target = keys ?? deleteTarget;
    if (!target || target.length === 0) return;
    deleteMutation.mutate(target);
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeletePreview(null);
  };

  return {
    mediaItems,
    folders,
    currentFolder,
    setFolder,
    breadcrumbs,
    view: currentView,
    setView,
    totalCount: mediaItems.length,
    searchQuery: search ?? "",
    setSearchQuery,
    unusedOnly: unused ?? false,
    setUnusedOnly,
    selectedIds: selectedKeys,
    toggleSelection,
    selectAll,
    deleteTarget,
    deletePreview,
    isDeleting: deleteMutation.isPending,
    requestDelete,
    confirmDelete,
    cancelDelete,
    refetch,
    loadMore,
    isLoadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    isPending,
    linkedMediaIds,
    totalMediaSize,
    updateAsset,
    createFolder,
    renameFolder,
  };
}
