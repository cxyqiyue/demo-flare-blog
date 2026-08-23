import { describe, expect, it } from "vitest";
import type { CfServiceUsage } from "@/features/cloudflare-usage/cloudflare-usage.schema";
import {
  computeAlertRows,
  renderUsageAlertContent,
  resolveAlertsToSend,
  type CfAlertRow,
} from "./cloudflare-usage-alerts.utils";

const DEFAULT_THRESHOLDS = {
  workersRequestsPct: 80,
  d1RowsReadPct: 80,
  r2StoragePct: 80,
  kvReadPct: 80,
  kvWritePct: 80,
  kvStoragePct: 80,
  queuesMessagesPct: 80,
  workflowsInvocationsPct: 80,
  workersAiPct: 80,
  durableObjectsRequestsPct: 80,
};

function svc(
  service: string,
  percentage: number,
  extra?: Partial<CfServiceUsage>,
): CfServiceUsage {
  return {
    service,
    displayName: service,
    used: percentage * 100,
    limit: 10000,
    unit: "requests/day",
    percentage,
    billingMetric: "Requests",
    ...extra,
  };
}

describe("computeAlertRows", () => {
  it("flags services at or above their threshold", () => {
    const alerts = computeAlertRows(
      [svc("workers", 85), svc("d1", 40), svc("kv", 100)],
      DEFAULT_THRESHOLDS,
    );
    expect(alerts.map((a) => a.service).sort()).toEqual(["kv", "workers"]);
  });

  it("skips services whose query failed (error set, data untrustworthy)", () => {
    const alerts = computeAlertRows(
      [svc("workers", 95, { error: "GraphQL errors: bad dataset" })],
      DEFAULT_THRESHOLDS,
    );
    expect(alerts).toEqual([]);
  });

  it("returns empty when thresholds are missing entirely", () => {
    expect(computeAlertRows([svc("workers", 99)], undefined)).toEqual([]);
  });
});

describe("resolveAlertsToSend", () => {
  const row = (service: string, level: "threshold" | "exhausted"): CfAlertRow => ({
    service,
    displayName: service,
    metric: "Requests",
    used: level === "exhausted" ? 10000 : 8500,
    limit: 10000,
    unit: "requests/day",
    percentage: level === "exhausted" ? 100 : 85,
    threshold: 80,
  });

  const DAY = "2026-08-23";

  it("sends everything on the first run and stores state", () => {
    const { toSend, nextState } = resolveAlertsToSend(
      [row("workers", "threshold")],
      null,
      DAY,
    );
    expect(toSend).toHaveLength(1);
    expect(nextState.workers).toEqual({ day: DAY, level: "threshold" });
  });

  it("does not resend for the same day/level (KV dedup)", () => {
    const { toSend } = resolveAlertsToSend(
      [row("workers", "threshold")],
      { workers: { day: DAY, level: "threshold" } },
      DAY,
    );
    expect(toSend).toEqual([]);
  });

  it("resends when escalating from threshold to exhausted the same day", () => {
    const { toSend, nextState } = resolveAlertsToSend(
      [row("workers", "exhausted")],
      { workers: { day: DAY, level: "threshold" } },
      DAY,
    );
    expect(toSend).toHaveLength(1);
    expect(nextState.workers.level).toBe("exhausted");
  });

  it("sends again on a new day after dropping below threshold", () => {
    const { toSend } = resolveAlertsToSend(
      [row("workers", "threshold")],
      { workers: { day: "2026-08-22", level: "threshold" } },
      DAY,
    );
    expect(toSend).toHaveLength(1);
  });

  it("prunes stale entries from previous days", () => {
    const { nextState } = resolveAlertsToSend([], null, DAY);
    expect(Object.keys(nextState)).toEqual([]);
  });
});

describe("renderUsageAlertContent", () => {
  const alerts: CfAlertRow[] = [
    {
      service: "r2",
      displayName: "r2",
      metric: "Storage",
      used: 6 * 1024 ** 3,
      limit: 10 * 1024 ** 3,
      unit: "bytes",
      percentage: 60,
      threshold: 50,
    },
  ];

  it("renders zh content with byte formatting", () => {
    const { subject, message, html } = renderUsageAlertContent("zh", alerts);
    expect(subject).toContain("Cloudflare 用量告警");
    expect(message).toContain("6.00 GB");
    expect(html).toContain("<ul>");
  });

  it("renders en content", () => {
    const { subject } = renderUsageAlertContent("en", alerts);
    expect(subject).toContain("Cloudflare Usage Alert");
  });
});
