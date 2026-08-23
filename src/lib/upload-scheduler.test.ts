import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Scheduler from "./upload-scheduler";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("withUploadSlot", () => {
  let scheduler: typeof Scheduler;

  beforeEach(async () => {
    // 调度器是模块级单例，重置以隔离各用例的节流状态
    vi.resetModules();
    vi.useFakeTimers();
    scheduler = await import("./upload-scheduler");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never exceeds the concurrency limit", async () => {
    const { MAX_CONCURRENT_UPLOADS, withUploadSlot } = scheduler;
    let active = 0;
    let peak = 0;

    const tasks = Array.from({ length: 6 }, () =>
      withUploadSlot(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await delay(10);
        active -= 1;
      }),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.all(tasks);

    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT_UPLOADS);
  });

  it("paces request starts at least MIN_START_GAP_MS apart", async () => {
    const { MIN_START_GAP_MS, withUploadSlot } = scheduler;
    const startTimes: number[] = [];

    const tasks = Array.from({ length: 4 }, () =>
      withUploadSlot(async () => {
        startTimes.push(Date.now());
        await delay(5);
      }),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.all(tasks);

    expect(startTimes).toHaveLength(4);
    for (let i = 1; i < startTimes.length; i++) {
      expect(startTimes[i] - startTimes[i - 1]).toBeGreaterThanOrEqual(
        MIN_START_GAP_MS,
      );
    }
  });

  it("runs queued tasks in FIFO order", async () => {
    const { withUploadSlot } = scheduler;
    const order: number[] = [];

    const tasks = [1, 2, 3, 4].map((n) =>
      withUploadSlot(async () => {
        order.push(n);
      }),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    await Promise.all(tasks);

    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("releases the slot when a task throws", async () => {
    const { MIN_START_GAP_MS, withUploadSlot } = scheduler;

    const failing = withUploadSlot(async () => {
      throw new Error("boom");
    });
    failing.catch(() => {});

    let ran = false;
    const followUp = withUploadSlot(async () => {
      ran = true;
    });

    await vi.advanceTimersByTimeAsync(MIN_START_GAP_MS * 2);
    await followUp;
    expect(ran).toBe(true);
  });
});
