import { describe, expect, it } from "vitest";
import { extractLatestRow, extractSumAllRows } from "./cf-graphql";

function wrap(rows: unknown): Record<string, unknown> {
  return {
    viewer: { accounts: [{ kvOperationsAdaptiveGroups: rows }] },
  };
}

describe("extractSumAllRows", () => {
  it("sums the field across every date row (fixes row-0-only bug)", () => {
    const data = wrap([
      { sum: { requests: 100 } },
      { sum: { requests: 200 } },
      { sum: { requests: 50 } },
    ]);
    expect(
      extractSumAllRows(
        data,
        "viewer.accounts.0.kvOperationsAdaptiveGroups",
        "sum.requests",
      ),
    ).toBe(350);
  });

  it("sums bare count rows (workflowsAdaptiveGroups)", () => {
    const data = {
      viewer: {
        accounts: [{ workflowsAdaptiveGroups: [{ count: 3 }, { count: 4 }] }],
      },
    };
    expect(
      extractSumAllRows(
        data,
        "viewer.accounts.0.workflowsAdaptiveGroups",
        "count",
      ),
    ).toBe(7);
  });

  it("returns 0 for empty or malformed payloads", () => {
    expect(
      extractSumAllRows(wrap([]), "viewer.accounts.0.kvOperationsAdaptiveGroups", "sum.requests"),
    ).toBe(0);
    expect(
      extractSumAllRows({}, "viewer.accounts.0.kvOperationsAdaptiveGroups", "sum.requests"),
    ).toBe(0);
  });
});

describe("extractLatestRow", () => {
  it("picks the newest-date value instead of accumulating gauges", () => {
    const rows = [
      { dimensions: { date: "2026-08-21" }, max: { byteCount: 300 } },
      { dimensions: { date: "2026-08-23" }, max: { byteCount: 111 } },
      { dimensions: { date: "2026-08-22" }, max: { byteCount: 999 } },
    ];
    const data = {
      viewer: { accounts: [{ kvStorageAdaptiveGroups: rows }] },
    };
    expect(
      extractLatestRow(
        data,
        "viewer.accounts.0.kvStorageAdaptiveGroups",
        "max.byteCount",
      ),
    ).toBe(111);
  });

  it("supports a custom dimension path such as r2 datetime buckets", () => {
    const rows = [
      { dimensions: { datetime: "2026-08-23T00:00:00Z" }, max: { payloadSize: 5 } },
      { dimensions: { datetime: "2026-08-23T12:00:00Z" }, max: { payloadSize: 42 } },
    ];
    const data = {
      viewer: { accounts: [{ r2StorageAdaptiveGroups: rows }] },
    };
    expect(
      extractLatestRow(
        data,
        "viewer.accounts.0.r2StorageAdaptiveGroups",
        "max.payloadSize",
        "dimensions.datetime",
      ),
    ).toBe(42);
  });

  it("returns 0 when there are no rows", () => {
    const data = {
      viewer: { accounts: [{ kvStorageAdaptiveGroups: [] }] },
    };
    expect(
      extractLatestRow(
        data,
        "viewer.accounts.0.kvStorageAdaptiveGroups",
        "max.byteCount",
      ),
    ).toBe(0);
  });

  it("handles rows without a dimensions block by treating them as oldest", () => {
    const rows = [
      { max: { byteCount: 7 } },
      { dimensions: { date: "2026-01-01" }, max: { byteCount: 42 } },
    ];
    const data = {
      viewer: { accounts: [{ kvStorageAdaptiveGroups: rows }] },
    };
    expect(
      extractLatestRow(
        data,
        "viewer.accounts.0.kvStorageAdaptiveGroups",
        "max.byteCount",
      ),
    ).toBe(42);
  });
});
