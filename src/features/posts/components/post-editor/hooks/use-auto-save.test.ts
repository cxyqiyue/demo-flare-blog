// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPostData, type PostEditorData } from "../types";
import { useAutoSave } from "./use-auto-save";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("editor auto-save security metadata", () => {
  it.each([
    ["visibility", "password"],
    ["password", "new-secret"],
    ["passwordChannel", "https://example.com/password"],
    ["passwordHint", "Ask the author"],
  ] as const)("saves an independent %s change", async (field, value) => {
    const initial = { ...defaultPostData };
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ post }) => useAutoSave({ post, onSave }), { initialProps: { post: initial } });
    const changed: PostEditorData = { ...initial, [field]: value };
    rerender({ post: changed });
    expect(result.current.isDirty).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(onSave).toHaveBeenCalledExactlyOnceWith(changed);
    expect(result.current.isDirty).toBe(false);
  });

  it("flushes immediately and serializes newer edits behind an in-flight save", async () => {
    const first = deferred();
    const initial = { ...defaultPostData };
    const onSave = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ post }) => useAutoSave({ post, onSave }), { initialProps: { post: initial } });
    rerender({ post: { ...initial, password: "first" } });
    let flush!: Promise<PostEditorData>;
    await act(async () => { flush = result.current.flushSave(); await Promise.resolve(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    const latest = { ...initial, password: "second", passwordHint: "updated" };
    rerender({ post: latest });
    let publishingFlush!: Promise<PostEditorData>;
    await act(async () => { publishingFlush = result.current.flushSave(); await Promise.resolve(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(); await Promise.all([flush, publishingFlush]); });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(latest);
    expect(await publishingFlush).toBe(latest);
    expect(result.current.isDirty).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("keeps failed saves dirty and rejects the publication flush", async () => {
    const failure = new Error("save failed");
    const onSave = vi.fn().mockRejectedValue(failure);
    const initial = { ...defaultPostData };
    const { result, rerender } = renderHook(({ post }) => useAutoSave({ post, onSave }), { initialProps: { post: initial } });
    rerender({ post: { ...initial, password: "unsaved-secret" } });
    await act(async () => { await expect(result.current.flushSave()).rejects.toBe(failure); });
    expect(result.current.saveStatus).toBe("ERROR");
    expect(result.current.isDirty).toBe(true);
  });
});
