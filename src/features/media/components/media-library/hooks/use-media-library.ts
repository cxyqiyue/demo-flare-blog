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
  createExternalFolderFn,
  deleteExternalFilesFn,
  deleteImageFn,
  deleteMediaFoldersFn,
  getMediaDirectoryFn,
  listExternalDirectoryFn,
  moveMediaFileFn,
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
import { findProvider } from "./use-media-providers";
import type { MediaProvider } from "@/features/media/media.schema";

const isFolderKey = (key: string) => key.endsWith("/");

// Unified file type for all providers
export interface MediaFileItem {
  key: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeInBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date | null;
  isLinked: boolean;
}

export function useMediaLibrary(providers: MediaProvider[]) {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/admin/media/" });
  const { search, unused, folder, view, provider: providerParam } = useSearch({
    from: "/admin/media/",
  });

  const currentProviderId = useMemo(() => {
    if (providerParam) return providerParam;
    const defaultProvider = providers.find((p) => p.isDefault);
    if (defaultProvider) return defaultProvider.id;
    const listable = providers.find((p) => p.canList);
    return listable?.id ?? "r2";
  }, [providerParam, providers]);
  const currentProvider = findProvider(providers, currentProviderId);

  // Auto-switch if the URL-pinned provider no longer exists in the list
  useEffect(() => {
    if (providers.length === 0) return;
    if (providerParam && !findProvider(providers, providerParam)) {
      const fallback = providers.find((p) => p.canList);
      if (fallback) {
        navigate({
          search: {
            search: search ?? "",
            unused: unused ?? false,
            folder: "",
            view: currentView,
            provider: fallback.id,
          },
          replace: true,
        });
      }
    }
  }, [providers, providerParam]);
  const isExternal = currentProviderId !== "r2";
  const canList = currentProvider?.canList ?? false;

  const currentFolder = folder ?? "";
  const currentView = view ?? "grid";

  // Navigation helpers — all preserve provider
  const navigateSearch = (patch: Record<string, unknown>) => {
    navigate({
      search: {
        search: search ?? "",
        unused: unused ?? false,
        folder,
        view: currentView,
        provider: currentProviderId,
        ...patch,
      },
      replace: true,
    });
  };

  const setSearchQuery = (term: string) => navigateSearch({ search: term, folder: "" });
  const setUnusedOnly = (val: boolean) => navigateSearch({ unused: val });
  const setFolder = (nextFolder: string) => navigateSearch({ folder: nextFolder });
  const setView = (nextView: "grid" | "table") => navigateSearch({ view: nextView });

  const setProvider = (id: string) => {
    navigate({
      search: {
        search: "",
        unused: false,
        folder: "",
        view: currentView,
        provider: id,
      },
    });
  };

  const debouncedSearch = useDebounce(search ?? "", 300);

  // Selection & Deletion State
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<Array<string> | null>(null);
  const [deletePreview, setDeletePreview] = useState<{
    folders: number;
    files: number;
  } | null>(null);

  // ── R2 Directory Query (existing, DB-backed) ──
  const r2Query = useInfiniteQuery({
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
    enabled: !isExternal,
  });

  // ── External (S3) Directory Query ──
  const externalQuery = useInfiniteQuery({
    queryKey: ["media", "external", currentProviderId, currentFolder],
    queryFn: ({ pageParam }) =>
      listExternalDirectoryFn({
        data: {
          providerId: currentProviderId,
          folder: currentFolder || undefined,
          continuationToken: pageParam ?? undefined,
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextContinuationToken ?? null,
    enabled: isExternal && canList,
  });

  // Merge results based on provider
  const isPending = isExternal ? externalQuery.isPending : r2Query.isPending;

  const mediaItems: MediaFileItem[] = useMemo(() => {
    if (isExternal) {
      const files = (externalQuery.data?.pages.flatMap((page) => page.files) ?? []).map((f) => ({
        key: f.key,
        fileName: f.name,
        url: f.url,
        mimeType: f.mimeType,
        sizeInBytes: f.sizeInBytes,
        width: null,
        height: null,
        createdAt: null,
        isLinked: false,
      }));
      // Client-side search filtering for external providers
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        return files.filter((f) => f.fileName.toLowerCase().includes(query));
      }
      return files;
    }
    return (r2Query.data?.pages.flatMap((page) => page.files) ?? []).map((file) => ({
      ...file,
      fileName: file.name,
    }));
  }, [isExternal, externalQuery.data, r2Query.data, debouncedSearch]);

  const folders = useMemo(() => {
    if (isExternal) {
      return externalQuery.data?.pages.flatMap((page) => page.folders) ?? [];
    }
    return r2Query.data?.pages.flatMap((page) => page.folders) ?? [];
  }, [isExternal, externalQuery.data, r2Query.data]);

  // Linked media keys — only for R2
  const mediaKeys = useMemo(() => mediaItems.map((item) => item.key), [mediaItems]);
  const { data: linkedKeysData } = useQuery({
    ...linkedMediaKeysQuery(mediaKeys),
    enabled: mediaKeys.length > 0 && !isExternal,
  });
  const { data: totalMediaSize } = useQuery(totalMediaSizeQuery);

  const linkedMediaIds = useMemo(() => new Set<string>(linkedKeysData ?? []), [linkedKeysData]);

  // Breadcrumbs
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
  }, [debouncedSearch, unused, currentFolder, currentProviderId]);

  // ── Folder operations ──
  const createFolder = useMutation({
    mutationFn: (name: string) =>
      isExternal && currentProviderId
        ? createExternalFolderFn({ data: { providerId: currentProviderId, name, parent: currentFolder } })
        : createMediaFolderFn({ data: { name, parent: currentFolder } }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.media_toast_folder_create_fail(), {
          description: m.media_toast_folder_create_fail_desc(),
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      toast.success(m.media_toast_folder_create_success(), {
        description: m.media_toast_folder_create_success_desc({ name: result.data.name }),
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
        description: m.media_toast_folder_rename_success_desc({ name: variables.name }),
      });
    },
  });

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: async (keys: Array<string>) => {
      const folderKeys = keys.filter(isFolderKey);
      const fileKeys = keys.filter((k) => !isFolderKey(k));

      // External provider (S3)
      if (isExternal && currentProvider?.canDelete) {
        const result = await deleteExternalFilesFn({
          data: { providerId: currentProviderId, keys: fileKeys },
        });
        return {
          deletedFiles: fileKeys.slice(0, result.deleted),
          deletedFolders: 0,
          skippedFiles: result.skipped,
          error: null,
        };
      }

      // R2 (existing logic)
      const deletedFiles: Array<string> = [];
      for (const key of fileKeys) {
        const result = await deleteImageFn({ data: { key } });
        if (result.error) {
          return { deletedFiles, deletedFolders: 0, skippedFiles: 0, error: result.error };
        }
        deletedFiles.push(key);
      }

      let deletedFolders = 0;
      let skippedFiles = 0;
      if (folderKeys.length > 0) {
        const result = (await deleteMediaFoldersFn({ data: { keys: folderKeys } })) as unknown as {
          data: { deletedFolders: number; deletedFiles: number; skippedFiles: number };
          error: { reason: string } | null;
        };
        if (result.error) {
          return { deletedFiles, deletedFolders, skippedFiles, error: result.error };
        }
        deletedFolders = result.data.deletedFolders;
        skippedFiles = result.data.skippedFiles;
      }

      return { deletedFiles, deletedFolders, skippedFiles, error: null };
    },
    onSuccess: (result) => {
      const totalDeleted = result.deletedFiles.length + (result.deletedFolders > 0 ? result.deletedFolders : 0);
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
            description: m.media_toast_partial_delete_desc({ count: totalDeleted }),
          });
        } else {
          toast.warning(m.media_toast_delete_fail(), { description: m.media_toast_delete_fail_desc() });
        }
        return;
      }
      toast.success(m.media_toast_delete_success(), {
        description: m.media_toast_delete_success_desc({ count: totalDeleted }),
      });
      if (result.skippedFiles > 0) {
        toast.warning(m.media_toast_folder_delete_skipped(), {
          description: m.media_toast_folder_delete_skipped_desc({ count: result.skippedFiles }),
        });
      }
    },
    onSettled: () => {
      setDeleteTarget(null);
      setDeletePreview(null);
    },
  });

  // Update name (R2 + S3 with sync)
  const updateAsset = useMutation({
    mutationFn: (payload: Parameters<typeof updateMediaNameFn>[0]) => {
      if (isExternal && currentProviderId) {
        const data = payload.data as { key: string; name: string };
        return updateMediaNameFn({ data: { ...data, providerId: currentProviderId } });
      }
      return updateMediaNameFn(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      toast.success(m.media_toast_metadata_updated(), { description: m.media_toast_metadata_updated_desc() });
    },
  });

  // Move file to another folder
  const moveFile = useMutation({
    mutationFn: (payload: { key: string; targetFolder: string }) =>
      moveMediaFileFn({
        data: {
          ...payload,
          providerId: isExternal ? currentProviderId : undefined,
        },
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.media_toast_move_fail(), { description: m.media_toast_move_fail_desc() });
        return;
      }
      queryClient.invalidateQueries({ queryKey: MEDIA_KEYS.all });
      toast.success(m.media_toast_move_success(), { description: m.media_toast_move_success_desc() });
    },
  });

  // Load more
  const loadMore = useCallback(() => {
    if (isExternal) {
      if (!externalQuery.isFetchingNextPage && externalQuery.hasNextPage) externalQuery.fetchNextPage();
    } else {
      if (!r2Query.isFetchingNextPage && r2Query.hasNextPage) r2Query.fetchNextPage();
    }
  }, [isExternal, r2Query, externalQuery]);

  const isLoadingMore = isExternal ? externalQuery.isFetchingNextPage : r2Query.isFetchingNextPage;
  const hasMore = isExternal ? externalQuery.hasNextPage : r2Query.hasNextPage;

  const refetch = useCallback(() => {
    if (isExternal) externalQuery.refetch();
    else r2Query.refetch();
  }, [isExternal, r2Query, externalQuery]);

  // Selection handlers
  const toggleSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const allKeys = [...folders.map((f) => f.key), ...mediaItems.map((item) => item.key)];
    if (selectedKeys.size === allKeys.length && allKeys.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(allKeys));
    }
  };

  // Request delete — skip linked check for external providers
  const requestDelete = (keys: Array<string>) => {
    if (!isExternal) {
      const blockedKeys = keys.filter((key) => !isFolderKey(key) && linkedMediaIds.has(key));
      const allowedKeys = keys.filter((key) => isFolderKey(key) || !linkedMediaIds.has(key));
      if (blockedKeys.length > 0) {
        toast.warning(m.media_toast_protected_delete(), {
          description: m.media_toast_protected_delete_desc({ count: blockedKeys.length }),
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
    }
    // External: no linked check
    setDeleteTarget(keys);
    setDeletePreview({ folders: 0, files: keys.length });
    return keys;
  };

  const confirmDelete = (keys?: Array<string>) => {
    const target = keys ?? deleteTarget;
    if (!target || target.length === 0) return;
    deleteMutation.mutate(target);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeletePreview(null);
  };

  const externalError = useMemo(() => {
    if (!isExternal) return undefined;
    if (externalQuery.error) {
      return externalQuery.error.message || "S3 request failed";
    }
    const lastPage = externalQuery.data?.pages[externalQuery.data.pages.length - 1];
    return lastPage?.error;
  }, [isExternal, externalQuery.data, externalQuery.error]);

  return {
    // Provider
    currentProviderId,
    currentProvider,
    setProvider,
    isExternal,
    // Data
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
    // Selection
    selectedIds: selectedKeys,
    toggleSelection,
    selectAll,
    // Delete
    deleteTarget,
    deletePreview,
    isDeleting: deleteMutation.isPending,
    requestDelete,
    confirmDelete,
    cancelDelete,
    // Pagination
    refetch,
    loadMore,
    isLoadingMore,
    hasMore,
    isPending,
    // R2-specific
    linkedMediaIds,
    totalMediaSize,
    updateAsset,
    moveFile,
    createFolder,
    renameFolder,
    // External errors
    externalError,
  };
}
