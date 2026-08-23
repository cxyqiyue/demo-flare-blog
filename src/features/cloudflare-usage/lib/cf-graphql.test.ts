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
      { sum: { reads: 100 } },
      { sum: { reads: 200 } },
      { sum: { reads: 50 } },
    ]);
    expect(
      extractSumAllRows(data, "viewer.accounts.0.kvOperationsAdaptiveGroups", "reads"),
    ).toBe(350);
  });

  it("returns 0 for empty or malformed payloads", () => {
    expect(
      extractSumAllRows(wrap([]), "viewer.accounts.0.kvOperationsAdaptiveGroups", "reads"),
    ).toBe(0);
    expect(extractSumAllRows({}, "viewer.accounts.0.kvOperationsAdaptiveGroups", "reads")).toBe(0);
  });
});

describe("extractLatestRow", () => {
  it("picks the newest-date value instead of accumulating gauges", () => {
    const rows = [
      { dimensions: { date: "2026-08-21" }, sum: { storage: 300 } },
      { dimensions: { date: "2026-08-23" }, sum: { storage: 111 } },
      { dimensions: { date: "2026-08-22" }, sum: { storage: 999 } },
    ];
    const data = {
      viewer: { accounts: [{ r2StorageAdaptiveGroups: rows }] },
    };
    expect(
      extractLatestRow(data, "viewer.accounts.0.r2StorageAdaptiveGroups", "storage"),
    ).toBe(111);
  });

  it("returns 0 when there are no rows", () => {
    const data = {
      viewer: { accounts: [{ r2StorageAdaptiveGroups: [] }] },
    };
    expect(
      extractLatestRow(data, "viewer.accounts.0.r2StorageAdaptiveGroups", "storage"),
    ).toBe(0);
  });

  it("handles rows without a dimensions block by treating them as oldest", () => {
    const rows = [
      { sum: { storage: 7 } },
      { dimensions: { date: "2026-01-01" }, sum: { storage: 42 } },
    ];
    const data = {
      viewer: { accounts: [{ r2StorageAdaptiveGroups: rows }] },
    };
    expect(
      extractLatestRow(data, "viewer.accounts.0.r2StorageAdaptiveGroups", "storage"),
    ).toBe(42);
  });
});
