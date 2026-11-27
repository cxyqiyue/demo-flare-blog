// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("@/features/posts/api/posts.admin.api", () => ({ startPostProcessWorkflowFn: api.start, generateSlugFn: vi.fn(), previewSummaryFn: vi.fn() }));
vi.mock("@/features/tags/api/tags.api", () => ({ createTagFn: vi.fn(), generateTagsFn: vi.fn() }));
vi.mock("@/features/tags/queries", () => ({ TAGS_KEYS: { all: ["tags"] } }));
vi.mock("@/features/posts/utils/content", () => ({ convertToPlainText: () => "", slugify: () => "post" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/paraglide/messages", () => ({ m: new Proxy({}, { get: (_, key) => () => String(key) }) }));

import { defaultPostData, type PostEditorData } from "../types";
import { useAutoSave } from "./use-auto-save";
import { usePostActions } from "./use-post-actions";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }, children);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => { vi.useFakeTimers(); api.start.mockReset().mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("publish current editor data", () => {
  it.each([
    ["visibility", "password"], ["password", "secret"],
    ["passwordChannel", "https://example.com"], ["passwordHint", "ask me"],
  ] as const)("marks an independent %s edit out of sync", (field, value) => {
    const initial = { ...defaultPostData, isSynced: true };
    const { result, rerender } = renderHook(({ post }) => usePostActions({ postId: 7, post, initialData: initial, setPost: vi.fn(), setError: vi.fn(), allTags: [], saveBeforePublish: vi.fn() }), { initialProps: { post: initial }, wrapper });
    expect(result.current.isDirty).toBe(false);
    rerender({ post: { ...initial, [field]: value } });
    expect(result.current.isDirty).toBe(true);
  });

  it("waits for saving instead of racing the 1500ms debounce", async () => {
    const saved = deferred();
    const initial = { ...defaultPostData, isSynced: true };
    const onSave = vi.fn(() => saved.promise);
    const { result, rerender } = renderHook(({ post }) => {
      const auto = useAutoSave({ post, onSave });
      return usePostActions({ postId: 7, post, initialData: initial, setPost: vi.fn(), setError: vi.fn(), allTags: [], saveBeforePublish: auto.flushSave });
    }, { initialProps: { post: initial }, wrapper });
    const current: PostEditorData = { ...initial, visibility: "password", password: "new-secret" };
    rerender({ post: current });
    await act(async () => { result.current.handleProcessData(); await Promise.resolve(); });
    expect(onSave).toHaveBeenCalledExactlyOnceWith(current);
    await act(async () => { await vi.advanceTimersByTimeAsync(1499); });
    expect(api.start).not.toHaveBeenCalled();
    await act(async () => { saved.resolve(); await vi.advanceTimersByTimeAsync(0); });
    expect(api.start).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ id: 7, status: current.status }) });
    expect(result.current.isDirty).toBe(false);
  });

  it("does not publish when the current save fails", async () => {
    const saveBeforePublish = vi.fn().mockRejectedValue(new Error("save failed"));
    const initial = { ...defaultPostData };
    const { result } = renderHook(() => usePostActions({ postId: 7, post: initial, initialData: initial, setPost: vi.fn(), setError: vi.fn(), allTags: [], saveBeforePublish }), { wrapper });
    await act(async () => { result.current.handleProcessData(); await vi.advanceTimersByTimeAsync(0); });
    expect(api.start).not.toHaveBeenCalled();
    expect(result.current.processState).toBe("IDLE");
  });
});
