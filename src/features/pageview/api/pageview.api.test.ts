import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestHeader: vi.fn(),
  getViewCounts: vi.fn(),
  recordPageView: vi.fn(),
  middleware: vi.fn(),
  sessionMiddleware: { name: "session" },
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: (middlewares: unknown) => {
        mocks.middleware(middlewares);
        return builder;
      },
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: mocks.getRequestHeader,
}));
vi.mock("@/lib/middlewares", () => ({
  sessionMiddleware: mocks.sessionMiddleware,
}));
vi.mock("@/lib/env/server.env", () => ({
  serverEnv: (env: { ADMIN_EMAIL?: string; PAGEVIEW_SALT?: string }) => ({
    ADMIN_EMAIL: env.ADMIN_EMAIL ?? "",
    PAGEVIEW_SALT: env.PAGEVIEW_SALT ?? "salt",
  }),
}));
vi.mock("@/features/pageview/service/pageview.service", () => ({
  getViewCounts: mocks.getViewCounts,
  recordPageView: mocks.recordPageView,
}));

import {
  getViewCountsFn,
  recordPageViewFn,
} from "@/features/pageview/api/pageview.api";
import { sha256 } from "@/features/pageview/utils/hash";

type Handler = (args: { context: unknown; data: unknown }) => Promise<unknown>;
const cookie = "blog_post_unlock=7.9999999999.token";

describe("Pageview API viewer context", () => {
  beforeEach(() => {
    mocks.getViewCounts.mockReset();
    mocks.recordPageView.mockReset();
    const headers: Record<string, string> = {
      cookie,
      "cf-connecting-ip": "192.0.2.1",
      "user-agent": "Pageview test",
    };
    mocks.getRequestHeader.mockImplementation((name: string) => headers[name]);
  });

  it("resolves optional sessions for both pageview endpoints", () => {
    expect(mocks.middleware).toHaveBeenCalledTimes(2);
    expect(mocks.middleware).toHaveBeenNthCalledWith(1, [
      mocks.sessionMiddleware,
    ]);
    expect(mocks.middleware).toHaveBeenNthCalledWith(2, [
      mocks.sessionMiddleware,
    ]);
  });

  it("passes anonymous password Cookie grants into count authorization", async () => {
    const context = { env: { ADMIN_EMAIL: "super@example.com" }, db: {} };
    mocks.getViewCounts.mockResolvedValue({ slug: 4 });
    expect(
      await (getViewCountsFn as unknown as Handler)({
        context,
        data: { slugs: ["slug"] },
      }),
    ).toEqual({ slug: 4 });
    expect(mocks.getViewCounts).toHaveBeenCalledWith(
      {
        ...context,
        viewer: {
          userId: null,
          isSuperAdmin: false,
          unlockTokens: ["7.9999999999.token"],
        },
      },
      ["slug"],
    );
  });

  it.each([
    ["owner", "owner@example.com", null, false],
    ["admin", "admin@example.com", "admin", false],
    ["super", "super@example.com", null, true],
  ] as const)("passes the %s identity and Cookie into guarded recording", async (id, email, role, isSuperAdmin) => {
    const context = {
      env: { ADMIN_EMAIL: "super@example.com" },
      db: {},
      session: { user: { id, email, role } },
    };
    await (recordPageViewFn as unknown as Handler)({
      context,
      data: { postId: 7 },
    });
    expect(mocks.recordPageView).toHaveBeenCalledWith(
      {
        ...context,
        viewer: {
          userId: id,
          isSuperAdmin,
          unlockTokens: ["7.9999999999.token"],
        },
      },
      { postId: 7, visitorHash: await sha256("192.0.2.1:Pageview test:salt") },
    );
  });
});
