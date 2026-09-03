import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createAnnouncementFn,
  deleteAnnouncementFn,
  resendAnnouncementFn,
  sendAnnouncementFn,
  updateAnnouncementFn,
} from "@/features/announcements/api/announcements.admin.api";
import { ANNOUNCEMENTS_KEYS } from "@/features/announcements/queries";
import { m } from "@/paraglide/messages";

function invalidateAnnouncements(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEYS.all });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAnnouncementFn,
    onSuccess: () => {
      invalidateAnnouncements(queryClient);
      toast.success(m.announcements_admin_title());
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAnnouncementFn,
    onSuccess: () => invalidateAnnouncements(queryClient),
  });
}

export function useDeleteAnnouncement(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAnnouncementFn,
    onSuccess: () => {
      invalidateAnnouncements(queryClient);
      toast.success(m.announcements_delete_success());
      onSuccess?.();
    },
  });
}

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendAnnouncementFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEYS.all });
      if (result.data?.success) {
        toast.success(
          m.announcements_send_success({ count: result.data.recipients }),
        );
      } else {
        const reason = result.error?.reason;
        if (reason === "ANNOUNCEMENT_ALREADY_SENT") {
          toast.error(m.announcements_send_error());
        } else {
          toast.error(m.announcements_send_error());
        }
      }
    },
  });
}

export function useResendAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resendAnnouncementFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEYS.all });
      if (result.data?.success) {
        toast.success(
          m.announcements_resend_success({
            sent: result.data.resent,
            failed: result.data.failed,
          }),
        );
      } else {
        toast.error(m.announcements_resend_error());
      }
    },
  });
}