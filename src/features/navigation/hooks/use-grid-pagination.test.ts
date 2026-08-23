import { describe, expect, it } from "vitest";
import {
  resolveColumnCount,
  resolveRowsPerPage,
} from "./use-grid-pagination";

describe("resolveColumnCount", () => {
  it("returns at least one column even for zero or tiny widths", () => {
    expect(resolveColumnCount(0)).toBe(1);
    expect(resolveColumnCount(-10)).toBe(1);
    expect(resolveColumnCount(50)).toBe(1);
  });

  it("fits exactly one card per column on narrow phones", () => {
    // 容器 150px：只能放一张 144px 卡片
    expect(resolveColumnCount(150)).toBe(1);
  });

  it("computes columns from fixed card size plus gap", () => {
    // (328 + 8) / (144 + 8) = 2.21 -> 2 列（360px 手机）
    expect(resolveColumnCount(328)).toBe(2);
    // (700 + 8) / 152 = 4.65 -> 4 列（平板）
    expect(resolveColumnCount(700)).toBe(4);
    // (848 + 8) / 152 = 5.63 -> 5 列（桌面 max-w-4xl）
    expect(resolveColumnCount(848)).toBe(5);
  });

  it("honors custom card width and gap", () => {
    expect(resolveColumnCount(400, 176, 8)).toBe(2);
  });
});

describe("resolveRowsPerPage", () => {
  it("uses device tiers: mobile 3 / tablet 4 / desktop 5", () => {
    expect(resolveRowsPerPage(375)).toBe(3);
    expect(resolveRowsPerPage(639)).toBe(3);
    expect(resolveRowsPerPage(640)).toBe(4);
    expect(resolveRowsPerPage(768)).toBe(4);
    expect(resolveRowsPerPage(1023)).toBe(4);
    expect(resolveRowsPerPage(1024)).toBe(5);
    expect(resolveRowsPerPage(1920)).toBe(5);
  });
});
