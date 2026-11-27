// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelQueries: vi.fn(), invalidateQueries: vi.fn(), fetchQuery: vi.fn(), back: vi.fn(), fetch: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => mocks }));
vi.mock("@tanstack/react-router", () => ({ ClientOnly: ({ children }: { children: unknown }) => children }));
vi.mock("@/features/posts/queries", () => ({ postBySlugQuery: (slug: string) => ({ queryKey: ["posts", "detail", slug] }) }));
vi.mock("@/hooks/use-navigate-back", () => ({ useNavigateBack: () => mocks.back }));
vi.mock("@/lib/theme-mode", () => ({ isFlare: true, isFuwari: false }));
vi.mock("@/paraglide/messages", () => ({ m: new Proxy({}, { get: (_, key) => (args?: { seconds: string }) => key === "access_gate_retry_countdown" ? "retry " + args?.seconds : String(key) }) }));
import type { PostWithToc } from "@/features/posts/schema/posts.schema";
import { PostGateShell } from "./post-gate-shell";

const post = { slug: "protected", title: "Protected post", gate: "password", passwordHint: null, passwordChannel: null } as Exclude<PostWithToc, null>;
async function submit() {
  const input = screen.getByLabelText("access_gate_input_label");
  fireEvent.change(input, { target: { value: "secret" } });
  await act(async () => { fireEvent.submit(input.closest("form")!); });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("__THEME_NAME__", "flare");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.cancelQueries.mockResolvedValue(undefined);
  mocks.invalidateQueries.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.style.overflow = ""; });

describe("post gate verification", () => {
  it.each([
    [401, "WRONG_PASSWORD", "wrong_password"],
    [404, "POST_NOT_FOUND", "post_not_found"],
    [401, "UNAUTHENTICATED", "generic"],
    [500, "SERVER_ERROR", "generic"],
  ] as const)("uses code %s/%s without guessing from HTTP status", async (status, code, suffix) => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code }), { status }));
    render(createElement(PostGateShell, { post }));
    await submit();
    expect(screen.getByRole("alert").textContent).toContain("access_gate_error_" + suffix);
    expect(screen.queryByText(/invalid_link/)).toBeNull();
  });

  it("enforces Retry-After and body cooldown before a new submission", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ code: "RATE_LIMITED", retryAfterMs: 2000 }), { status: 429, headers: { "Retry-After": "3" } }));
    render(createElement(PostGateShell, { post }));
    await submit();
    expect(screen.getByRole("alert").textContent).toContain("retry 3");
    await submit();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await submit();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the busy gate until a fresh fetch confirms content access", async () => {
    let resolve!: (post: unknown) => void;
    mocks.fetch.mockResolvedValue(new Response("{}", { status: 200 }));
    mocks.fetchQuery.mockReturnValue(new Promise((yes) => { resolve = yes; }));
    render(createElement(PostGateShell, { post }));
    await submit();
    expect(screen.getByRole("dialog").getAttribute("aria-busy")).toBe("true");
    expect(mocks.cancelQueries).toHaveBeenCalledWith({ queryKey: ["posts", "detail", "protected"], exact: true });
    expect(mocks.fetchQuery).toHaveBeenCalledWith(expect.objectContaining({ staleTime: 0 }));
    await act(async () => { resolve({ ...post, gate: "password" }); });
    expect(screen.getByRole("alert").textContent).toBe("access_gate_error_generic");
    expect(screen.queryByText("access_gate_password_success")).toBeNull();
  });

  it("refreshes viewer-dependent counts after the new cookie unlocks the Post", async () => {
    mocks.fetch.mockResolvedValue(new Response("{}", { status: 200 }));
    mocks.fetchQuery.mockResolvedValue({ ...post, gate: null });
    render(createElement(PostGateShell, { post }));
    await submit();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/post/verify-password", expect.objectContaining({
      credentials: "same-origin",
      body: JSON.stringify({ slug: "protected", password: "secret" }),
    }));
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["posts", "detail", "protected"], exact: true, refetchType: "none",
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ["pageview"] });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not call a refetch failure an incorrect password", async () => {
    mocks.fetch.mockResolvedValue(new Response("{}", { status: 200 }));
    mocks.fetchQuery.mockRejectedValue(new Error("network down"));
    render(createElement(PostGateShell, { post }));
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("access_gate_error_generic");
  });
});
