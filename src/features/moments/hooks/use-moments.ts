import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { m } from "@/paraglide/messages";
import {
  createMomentFn,
  deleteMomentFn,
  updateMomentFn,
} from "../api/moments.admin.api";
import { MOMENTS_KEYS } from "../queries";

export function useAdminMoments() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createMomentFn>[0]) => {
      return await createMomentFn(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOMENTS_KEYS.all });
      toast.success(m.moments_toast_create_success());
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateMomentFn>[0]) => {
      return await updateMomentFn(input);
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.moments_toast_update_failed());
        return;
      }

      queryClient.invalidateQueries({ queryKey: MOMENTS_KEYS.all });
      toast.success(m.moments_toast_update_success());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: Parameters<typeof deleteMomentFn>[0]) => {
      return await deleteMomentFn(input);
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(m.moments_toast_delete_failed());
        return;
      }

      queryClient.invalidateQueries({ queryKey: MOMENTS_KEYS.all });
      toast.success(m.moments_toast_delete_success());
    },
  });

  return {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    adminDelete: deleteMutation.mutate,
    isAdminDeleting: deleteMutation.isPending,
  };
}
