import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { JSONContent } from "@tiptap/react";

import { m } from "@/paraglide/messages";

export const isSSR = typeof window === "undefined";

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs));
}

function getLocalTimezone(): string {
  if (isSSR) return "UTC";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function formatDate(
  date: Date | undefined | null | string | number,
  options: { includeTime?: boolean } = {},
) {
  if (!date) return "";
  const d = new Date(date);
  const tz = getLocalTimezone();
  const fmtOpts: Intl.DateTimeFormatOptions = { timeZone: tz };
  if (options.includeTime) {
    Object.assign(fmtOpts, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } else {
    Object.assign(fmtOpts, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return new Intl.DateTimeFormat(undefined, fmtOpts).format(d);
}

export function formatTime(date: Date | undefined | null | string | number) {
  if (!date) return "";
  const d = new Date(date);
  const tz = getLocalTimezone();
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatMonthDayTime(
  date: Date | undefined | null | string | number,
) {
  if (!date) return "";
  const d = new Date(date);
  const tz = getLocalTimezone();
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatTimeAgo(date: Date | null | string) {
  if (!date) return "";
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - new Date(date).getTime()) / 1000,
  );

  if (diffInSeconds < 60) return m.time_ago_just_now();
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return m.time_ago_minutes({ count: diffInMinutes });
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return m.time_ago_hours({ count: diffInHours });
  const diffInDays = Math.floor(diffInHours / 24);
  return m.time_ago_days({ count: diffInDays });
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Sanitize a Tiptap JSONContent tree by removing empty text nodes that
 * would cause ProseMirror's `TextNode` constructor to throw
 * `RangeError("Empty text nodes are not allowed")`.
 */
export function sanitizeJsonContent(node: JSONContent): JSONContent | null {
  if (node.type === "text") {
    return typeof node.text === "string" && node.text.length > 0
      ? node
      : null;
  }
  if (node.content && Array.isArray(node.content)) {
    const cleaned = node.content
      .map((child) => sanitizeJsonContent(child as JSONContent))
      .filter(Boolean) as JSONContent[];
    return { ...node, content: cleaned };
  }
  return node;
}
