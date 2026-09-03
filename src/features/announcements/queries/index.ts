import { queryOptions } from "@tanstack/react-query";
import {
  getAnnouncementDetailFn,
  listAnnouncementDeliveriesFn,
  listAnnouncementsFn,
} from "../api/announcements.admin.api";

export const ANNOUNCEMENTS_KEYS = {
  all: ["announcements"] as const,
  list: (offset: number, limit: number) =>
    ["announcements", "list", offset, limit] as const,
  detail: (id: number) => ["announcements", "detail", id] as const,
  deliveries: (announcementId: number, options: unknown) =>
    ["announcements", "deliveries", announcementId, options] as const,
};

export function announcementsListQuery(
  options: { offset?: number; limit?: number } = {},
) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 20;
  return queryOptions({
    queryKey: ANNOUNCEMENTS_KEYS.list(offset, limit),
    queryFn: () => listAnnouncementsFn({ data: { offset, limit } }),
  });
}

export function announcementDetailQuery(id: number) {
  return queryOptions({
    queryKey: ANNOUNCEMENTS_KEYS.detail(id),
    queryFn: () => getAnnouncementDetailFn({ data: { id } }),
  });
}

export function announcementDeliveriesQuery(
  announcementId: number,
  options: { offset?: number; limit?: number; status?: "pending" | "sent" | "failed" } = {},
) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 20;
  return queryOptions({
    queryKey: ANNOUNCEMENTS_KEYS.deliveries(announcementId, options),
    queryFn: () =>
      listAnnouncementDeliveriesFn({
        data: { announcementId, offset, limit, status: options.status },
      }),
  });
}