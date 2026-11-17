import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toggleBlogSubscriptionFn } from "@/features/subscription/api/subscription.api";
import {
  blogSubscriptionStatusQuery,
  SUBSCRIPTION_KEYS,
} from "@/features/subscription/queries";
import { m } from "@/paraglide/messages";

export function useBlogSubscription(userId: string | undefined) {
  const queryClient = useQueryClient();

  const {
    data: status,
    isLoading,
    error: queryError,
  } = useQuery(blogSubscriptionStatusQuery(userId));

  const currentSubscribed = status?.subscribed;

  const mutation = useMutation({
    mutationFn: (enabled: boolean) =>
      toggleBlogSubscriptionFn({ data: { enabled } }),
    onError: () => {
      toast.error(m.profile_subscription_update_failed());
    },
  });

  return {
    available: status?.available ?? false,
    subscribed: currentSubscribed,
    isLoading,
    isPending: mutation.isPending,
    toggle: () => {
      if (isLoading || mutation.isPending) {
        return;
      }
      if (queryError) {
        toast.error(m.profile_subscription_update_failed());
        return;
      }
      if (!status?.available) {
        toast.error(m.profile_subscription_no_email());
        return;
      }
      if (currentSubscribed === undefined) {
        return;
      }

      const nextEnabled = !currentSubscribed;

      mutation.mutate(nextEnabled, {
        onSuccess: (result) => {
          if (result.error) {
            toast.error(
              result.error.reason === "SUBSCRIPTION_REQUIRES_EMAIL"
                ? m.profile_subscription_no_email()
                : m.profile_subscription_update_failed(),
            );
            return;
          }
          queryClient.setQueryData(SUBSCRIPTION_KEYS.status(userId), {
            available: status.available,
            subscribed: nextEnabled,
          });
          toast.success(
            nextEnabled
              ? m.profile_subscription_enabled()
              : m.profile_subscription_disabled(),
          );
        },
      });
    },
  };
}

export type UseBlogSubscriptionReturn = ReturnType<typeof useBlogSubscription>;
