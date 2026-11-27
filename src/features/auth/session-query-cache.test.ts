import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  clearSessionQueries,
  isSessionTransitionPending,
  observeSessionIdentity,
  runSessionTransition,
  sessionQueryIdentity,
} from "./session-query-cache";

describe("session query cache", () => {
  it("waits for a successful session change before clearing protected prefixes", async () => {
    const client = new QueryClient();
    const roots = ["auth", "posts", "comments", "search", "pageview", "dashboard"];
    for (const root of roots) client.setQueryData([root, "nested"], "old viewer");
    client.setQueryData(["config", "site"], "public config");
    let finish!: (result: { error: null }) => void;
    const change = new Promise<{ error: null }>((resolve) => { finish = resolve; });
    const transition = runSessionTransition(client, () => change);

    expect(isSessionTransitionPending(client)).toBe(true);
    for (const root of roots) {
      expect(client.getQueryData([root, "nested"])).toBe("old viewer");
    }
    finish({ error: null });
    await transition;
    for (const root of roots) {
      expect(client.getQueryData([root, "nested"])).toBeUndefined();
    }
    expect(client.getQueryData(["config", "site"])).toBe("public config");
    expect(isSessionTransitionPending(client)).toBe(false);
    client.clear();
  });

  it("keeps cached data when sign-out fails or throws", async () => {
    const client = new QueryClient();
    client.setQueryData(["posts", "detail", "private"], "body");
    await runSessionTransition(client, async () => ({ error: "failed" }));
    await expect(runSessionTransition(client, async () => {
      throw new Error("network failure");
    })).rejects.toThrow("network failure");
    expect(client.getQueryData(["posts", "detail", "private"])).toBe("body");
    expect(isSessionTransitionPending(client)).toBe(false);
    client.clear();
  });

  it("does not let an old request repopulate cleared private content", async () => {
    const client = new QueryClient();
    let finish!: (body: string) => void;
    const response = new Promise<string>((resolve) => { finish = resolve; });
    const request = client.fetchQuery({
      queryKey: ["posts", "detail", "private"],
      queryFn: () => response,
    }).catch(() => undefined);
    await clearSessionQueries(client);
    finish("old private body");
    await request;
    expect(client.getQueryData(["posts", "detail", "private"])).toBeUndefined();
    client.clear();
  });

  it("distinguishes external identity changes from a delayed local session update", async () => {
    const client = new QueryClient();
    const author = sessionQueryIdentity({ id: "author", role: "admin" });
    const reader = sessionQueryIdentity({ id: "reader" });
    expect(observeSessionIdentity(client, author)).toBe(false);
    await runSessionTransition(client, async () => ({ error: null }));
    expect(observeSessionIdentity(client, author)).toBe(false);
    expect(observeSessionIdentity(client, null)).toBe(false);
    expect(observeSessionIdentity(client, reader)).toBe(true);
    expect(observeSessionIdentity(client, null)).toBe(true);
    client.clear();
  });
});
