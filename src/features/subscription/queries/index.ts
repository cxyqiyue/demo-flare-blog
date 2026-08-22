import { queryOptions } from "@tanstack/react-query";
import { getBlogSubscriptionStatusFn } from "@/features/subscription/api/subscription.api";

export const SUBSCRIPTION_KEYS = {
  all: ["subscription"] as const,
  status: (userId?: string) =>
    ["subscription", "status", userId] as const,
};

export function blogSubscriptionStatusQuery(userId?: string) {
  return queryOptions({
    queryKey: SUBSCRIPTION_KEYS.status(userId),
    queryFn: () => getBlogSubscriptionStatusFn(),
    enabled: !!userId,
  });
}
