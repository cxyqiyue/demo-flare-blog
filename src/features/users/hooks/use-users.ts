import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { m } from "@/paraglide/messages";
import { banUserFn, setUserRoleFn, unbanUserFn } from "../api/users.admin.api";
import { USERS_KEYS } from "../queries";
import type { UserManageError } from "../users.schema";

function getErrorMessage(error: UserManageError): string {
  switch (error.reason) {
    case "NOT_FOUND":
      return m.users_toast_not_found();
    case "PROTECTED_USER":
      return m.users_toast_protected();
    case "PERMISSION_DENIED":
      return m.users_toast_permission_denied();
    default:
      return m.users_toast_unknown_error();
  }
}

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });

  const setRoleMutation = useMutation({
    mutationFn: async (input: Parameters<typeof setUserRoleFn>[0]) =>
      await setUserRoleFn(input),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        return;
      }
      invalidate();
      toast.success(m.users_toast_role_success());
    },
  });

  const banMutation = useMutation({
    mutationFn: async (input: Parameters<typeof banUserFn>[0]) =>
      await banUserFn(input),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        return;
      }
      invalidate();
      toast.success(m.users_toast_ban_success());
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (input: Parameters<typeof unbanUserFn>[0]) =>
      await unbanUserFn(input),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        return;
      }
      invalidate();
      toast.success(m.users_toast_unban_success());
    },
  });

  return {
    setRole: setRoleMutation.mutate,
    isSettingRole: setRoleMutation.isPending,
    ban: banMutation.mutate,
    isBanning: banMutation.isPending,
    unban: unbanMutation.mutate,
    isUnbanning: unbanMutation.isPending,
  };
}
