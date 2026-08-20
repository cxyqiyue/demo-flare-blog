import { queryOptions } from "@tanstack/react-query";
import {
  getCloudflareUsageFn,
  getCloudflareAlertStatusFn,
} from "../api/cloudflare-usage.api";

export const CF_USAGE_KEYS = {
  all: ["cloudflare-usage"] as const,
  usage: ["cloudflare-usage", "data"] as const,
  alert: ["cloudflare-usage", "alert"] as const,
};

export const cloudflareUsageQuery = queryOptions({
  queryKey: CF_USAGE_KEYS.usage,
  queryFn: () => getCloudflareUsageFn(),
});

export const cloudflareAlertQuery = queryOptions({
  queryKey: CF_USAGE_KEYS.alert,
  queryFn: () => getCloudflareAlertStatusFn(),
});
