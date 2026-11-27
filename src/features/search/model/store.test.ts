import { insert, save } from "@orama/orama";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMyDb } from "./schema";

const mocks = vi.hoisted(() => ({
  guardedKvPut: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/features/cache/kv-write-guard", () => ({
  guardedKvPut: mocks.guardedKvPut,
}));
vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

describe("search index persistence lifecycle", () => {
  const env = {} as Env;
  let store: typeof import("./store");

  beforeEach(async () => {
    vi.resetModules();
    mocks.guardedKvPut.mockReset().mockResolvedValue(true);
    mocks.getDb.mockReturnValue({
      delete: () => ({ where: () => ({}) }),
      insert: () => ({ values: () => ({}) }),
      batch: vi.fn().mockResolvedValue([]),
    });
    // Load cold Vite/schema dependencies before the timed case and fake clock.
    // A timed-out import otherwise resumes into the following test.
    store = await import("./store");
    vi.useFakeTimers();
    vi.stubGlobal("CompressionStream", undefined);
  }, 30_000);

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("settles every waiter when a later deferred update resets the timer", async () => {
    const { persistOramaDbDeferred } = store;
    const db = await createMyDb();
    const first = persistOramaDbDeferred(env, db);
    await vi.advanceTimersByTimeAsync(1_000);
    const second = persistOramaDbDeferred(env, db);

    expect(second).toBe(first);
    await vi.advanceTimersByTimeAsync(5_000);
    await Promise.all([first, second]);
    expect(mocks.guardedKvPut.mock.calls.map((call) => call[1])).toEqual([
      "search:index:v3",
      "search:index:meta:v3",
    ]);
  });

  it("fulfills deferred waitUntil work when immediate deletion supersedes it", async () => {
    const { persistOramaDb, persistOramaDbDeferred } = store;
    const db = await createMyDb();
    const deferred = persistOramaDbDeferred(env, db);

    await Promise.all([deferred, persistOramaDb(env, db)]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.guardedKvPut).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes an in-flight stale write before persisting the revoked index", async () => {
    const { persistOramaDb, persistOramaDbDeferred } = store;
    const staleDb = await createMyDb();
    await insert(staleDb, {
      id: "1", slug: "old-public", title: "Old public", summary: "secret",
      content: "old public body", tags: [],
    });
    const revokedDb = await createMyDb();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    mocks.guardedKvPut.mockImplementationOnce(() => blocked);

    const deferred = persistOramaDbDeferred(env, staleDb);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.guardedKvPut).toHaveBeenCalledTimes(1);
    const immediate = persistOramaDb(env, revokedDb);
    await Promise.resolve();
    expect(mocks.guardedKvPut).toHaveBeenCalledTimes(1);

    release();
    await Promise.all([deferred, immediate]);
    const indexWrites = mocks.guardedKvPut.mock.calls.filter(
      (call) => call[1] === "search:index:v3",
    );
    expect(indexWrites).toHaveLength(2);
    expect(new TextDecoder().decode(indexWrites[1][2])).toBe(
      JSON.stringify(save(revokedDb)),
    );
  });

  it("does not report success when the authoritative D1 backend fails", async () => {
    const { persistOramaDb } = store;
    const error = new Error("D1 unavailable");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getDb.mockReturnValue({
      delete: () => ({ where: () => ({}) }),
      insert: () => ({ values: () => ({}) }),
      batch: vi.fn().mockRejectedValue(error),
    });

    await expect(persistOramaDb(env, await createMyDb())).rejects.toBe(error);
  });

  it("rejects failed deferred work and allows subsequent immediate persistence", async () => {
    const { persistOramaDb, persistOramaDbDeferred } = store;
    const db = await createMyDb();
    const error = new Error("backend unavailable");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.guardedKvPut.mockRejectedValueOnce(error);
    const deferred = persistOramaDbDeferred(env, db);
    const rejected = expect(deferred).rejects.toBe(error);

    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    await expect(persistOramaDb(env, db)).resolves.toEqual(expect.any(String));
  });
});
