import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { m } from "@/paraglide/messages";
import {
  createBookmarkFn,
  createFolderFn,
  createSearchEngineFn,
  deleteBookmarkFn,
  deleteBookmarksFn,
  deleteFolderFn,
  deleteFoldersFn,
  deleteSearchEngineFn,
  importBookmarksFn,
  setDefaultSearchEngineFn,
  updateBookmarkFn,
  updateFolderFn,
  updateSearchEngineFn,
} from "../api/navigation.admin.api";
import { navigationAdminDataQuery, NAVIGATION_KEYS } from "../queries";

/** 管理后台读取完整导航数据（引擎、文件夹、书签）。ownerId 用于超管查看其它账号。 */
export function useAdminNavigationData(ownerId?: string) {
  const query = useQuery(navigationAdminDataQuery(ownerId));
  return query;
}

/**
 * ownerId 为该组件当前管理的账号（超管切换账号时传入，普通管理员为空表示本人）。
 * 所有写操作都会附带该 ownerId，由服务层校验后作用于对应账号。
 */
export function useAdminNavigation(ownerId?: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: NAVIGATION_KEYS.all });
  };

  const withOwner = <T extends Record<string, unknown>>(
    data: T,
  ): T & { ownerId?: string } =>
    ownerId ? { ...data, ownerId } : data;

  const createEngineMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createSearchEngineFn>[0]) =>
      await createSearchEngineFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_engine_create_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_engine_create_success());
    },
  });

  const updateEngineMutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateSearchEngineFn>[0]) =>
      await updateSearchEngineFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_engine_update_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_engine_update_success());
    },
  });

  const deleteEngineMutation = useMutation({
    mutationFn: async (input: Parameters<typeof deleteSearchEngineFn>[0]) =>
      await deleteSearchEngineFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_engine_delete_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_engine_delete_success());
    },
  });

  const setDefaultEngineMutation = useMutation({
    mutationFn: async (input: Parameters<typeof setDefaultSearchEngineFn>[0]) =>
      await setDefaultSearchEngineFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_engine_default_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_engine_default_success());
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createFolderFn>[0]) =>
      await createFolderFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_folder_create_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_folder_create_success());
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateFolderFn>[0]) =>
      await updateFolderFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_folder_update_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_folder_update_success());
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (input: Parameters<typeof deleteFolderFn>[0]) =>
      await deleteFolderFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_folder_delete_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_folder_delete_success());
    },
  });

  const deleteFoldersMutation = useMutation({
    mutationFn: async (input: Parameters<typeof deleteFoldersFn>[0]) =>
      await deleteFoldersFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_folder_delete_batch_fail());
        return;
      }
      invalidate();
      toast.success(
        m.navigation_admin_toast_folder_delete_batch_success({
          count: result.data.deleted,
        }),
      );
    },
  });

  const createBookmarkMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createBookmarkFn>[0]) =>
      await createBookmarkFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_bookmark_create_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_bookmark_create_success());
    },
  });

  const updateBookmarkMutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateBookmarkFn>[0]) =>
      await updateBookmarkFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_bookmark_update_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_bookmark_update_success());
    },
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: async (input: Parameters<typeof deleteBookmarkFn>[0]) =>
      await deleteBookmarkFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_bookmark_delete_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_bookmark_delete_success());
    },
  });

  const deleteBookmarksMutation = useMutation({
    mutationFn: async (input: Parameters<typeof deleteBookmarksFn>[0]) =>
      await deleteBookmarksFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_bookmark_delete_batch_fail());
        return;
      }
      invalidate();
      toast.success(
        m.navigation_admin_toast_bookmark_delete_batch_success({
          count: result.data.deleted,
        }),
      );
    },
  });

  const importBookmarksMutation = useMutation({
    mutationFn: async (input: Parameters<typeof importBookmarksFn>[0]) =>
      await importBookmarksFn({ data: withOwner(input.data) }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_import_fail());
        return;
      }
      invalidate();
      toast.success(
        m.navigation_admin_toast_import_success({
          count: result.data.imported,
        }),
      );
    },
  });

  return {
    createEngine: createEngineMutation.mutateAsync,
    isCreatingEngine: createEngineMutation.isPending,
    updateEngine: updateEngineMutation.mutateAsync,
    isUpdatingEngine: updateEngineMutation.isPending,
    deleteEngine: deleteEngineMutation.mutateAsync,
    isDeletingEngine: deleteEngineMutation.isPending,
    setDefaultEngine: setDefaultEngineMutation.mutateAsync,
    isSettingDefault: setDefaultEngineMutation.isPending,
    createFolder: createFolderMutation.mutateAsync,
    isCreatingFolder: createFolderMutation.isPending,
    updateFolder: updateFolderMutation.mutateAsync,
    isUpdatingFolder: updateFolderMutation.isPending,
    deleteFolder: deleteFolderMutation.mutateAsync,
    isDeletingFolder: deleteFolderMutation.isPending,
    deleteFolders: deleteFoldersMutation.mutateAsync,
    isDeletingFolders: deleteFoldersMutation.isPending,
    createBookmark: createBookmarkMutation.mutateAsync,
    isCreatingBookmark: createBookmarkMutation.isPending,
    updateBookmark: updateBookmarkMutation.mutateAsync,
    isUpdatingBookmark: updateBookmarkMutation.isPending,
    deleteBookmark: deleteBookmarkMutation.mutateAsync,
    isDeletingBookmark: deleteBookmarkMutation.isPending,
    deleteBookmarks: deleteBookmarksMutation.mutateAsync,
    isDeletingBookmarks: deleteBookmarksMutation.isPending,
    importBookmarks: importBookmarksMutation.mutateAsync,
    isImporting: importBookmarksMutation.isPending,
  };
}
