import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { m } from "@/paraglide/messages";
import {
  createBookmarkFn,
  createFolderFn,
  createSearchEngineFn,
  deleteBookmarkFn,
  deleteFolderFn,
  deleteSearchEngineFn,
  importBookmarksFn,
  setDefaultSearchEngineFn,
  updateBookmarkFn,
  updateFolderFn,
  updateSearchEngineFn,
} from "../api/navigation.admin.api";
import { getNavigationPublicDataFn } from "../api/navigation.user.api";
import { NAVIGATION_KEYS } from "../queries";

/** 管理后台读取完整导航数据（引擎、文件夹、书签） */
export function useAdminNavigationData() {
  const query = useQuery({
    queryKey: NAVIGATION_KEYS.admin,
    queryFn: async () => {
      // 复用公开数据查询（后台直接读取同样内容即可）
      return await getNavigationPublicDataFn();
    },
  });
  return query;
}

export function useAdminNavigation() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: NAVIGATION_KEYS.all });
  };

  const createEngineMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createSearchEngineFn>[0]) =>
      await createSearchEngineFn(input),
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
      await updateSearchEngineFn(input),
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
      await deleteSearchEngineFn(input),
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
      await setDefaultSearchEngineFn(input),
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
      await createFolderFn(input),
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
      await updateFolderFn(input),
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
      await deleteFolderFn(input),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_folder_delete_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_folder_delete_success());
    },
  });

  const createBookmarkMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createBookmarkFn>[0]) =>
      await createBookmarkFn(input),
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
      await updateBookmarkFn(input),
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
      await deleteBookmarkFn(input),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_bookmark_delete_fail());
        return;
      }
      invalidate();
      toast.success(m.navigation_admin_toast_bookmark_delete_success());
    },
  });

  const importBookmarksMutation = useMutation({
    mutationFn: async (input: Parameters<typeof importBookmarksFn>[0]) =>
      await importBookmarksFn(input),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.navigation_admin_toast_import_fail());
        return;
      }
      invalidate();
      toast.success(
        m.navigation_admin_toast_import_success({ count: result.data.imported }),
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
    createBookmark: createBookmarkMutation.mutateAsync,
    isCreatingBookmark: createBookmarkMutation.isPending,
    updateBookmark: updateBookmarkMutation.mutateAsync,
    isUpdatingBookmark: updateBookmarkMutation.isPending,
    deleteBookmark: deleteBookmarkMutation.mutateAsync,
    isDeletingBookmark: deleteBookmarkMutation.isPending,
    importBookmarks: importBookmarksMutation.mutateAsync,
    isImporting: importBookmarksMutation.isPending,
  };
}
