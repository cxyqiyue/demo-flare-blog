import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestHeader: vi.fn(),
  createViewerAccess: vi.fn(),
  roots: vi.fn(),
  replies: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: mocks.getRequestHeader,
}));
vi.mock("@/features/comments/comments.schema", () => ({
  CreateCommentInputSchema: {},
  DeleteCommentInputSchema: {},
  GetCommentsByTargetInputSchema: {},
  GetMyCommentsInputSchema: {},
  GetRepliesByRootIdInputSchema: {},
}));
vi.mock("@/features/comments/comments.service", () => ({
  getRootCommentsByTarget: mocks.roots,
  getRepliesByRootId: mocks.replies,
  createComment: mocks.create,
  deleteComment: vi.fn(),
  getMyComments: vi.fn(),
}));
vi.mock("@/features/posts/services/post-access.service", () => ({
  createViewerAccess: mocks.createViewerAccess,
}));
vi.mock("@/lib/middlewares", () => ({
  authMiddleware: {},
  sessionMiddleware: {},
  createRateLimitMiddleware: () => ({}),
}));

import {
  createCommentFn,
  getRepliesByRootIdFn,
  getRootCommentsByTargetFn,
} from "@/features/comments/api/comments.public.api";

type Handler = (args: { context: unknown; data: unknown }) => Promise<unknown>;
const viewer = {
  userId: null,
  isSuperAdmin: false,
  unlockTokens: ["valid-token"],
};
const cookie = "blog_post_unlock=valid-token";

describe("Comment API viewer context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestHeader.mockReturnValue(cookie);
    mocks.createViewerAccess.mockReturnValue(viewer);
  });

  it.each([
    ["roots", getRootCommentsByTargetFn, mocks.roots],
    ["replies", getRepliesByRootIdFn, mocks.replies],
  ] as const)("passes anonymous Cookie access to %s with an optional session", async (_label, fn, service) => {
    const context = { env: {}, db: {} };
    const data = { postId: 7, rootId: 11 };
    const result = { items: [], total: 0 };
    service.mockResolvedValue(result);
    expect(await (fn as unknown as Handler)({ context, data })).toBe(result);
    expect(mocks.getRequestHeader).toHaveBeenCalledWith("cookie");
    expect(mocks.createViewerAccess).toHaveBeenCalledWith(
      context.env,
      undefined,
      cookie,
    );
    expect(service).toHaveBeenCalledWith(
      { ...context, viewer },
      { ...data, viewerId: undefined },
    );
  });

  it("passes the session identity and Cookie to authenticated creation", async () => {
    const user = { id: "reader", email: "reader@example.com", role: null };
    const context = { env: {}, db: {}, session: { user } };
    const data = { postId: 7, content: { type: "doc" } };
    const result = { data: { id: 9 }, error: null };
    mocks.create.mockResolvedValue(result);
    expect(
      await (createCommentFn as unknown as Handler)({ context, data }),
    ).toBe(result);
    expect(mocks.createViewerAccess).toHaveBeenCalledWith(
      context.env,
      user,
      cookie,
    );
    expect(mocks.create).toHaveBeenCalledWith({ ...context, viewer }, data);
  });

  it("keeps the authenticated viewer ID for pending-comment visibility", async () => {
    const user = { id: "reader", email: "reader@example.com" };
    const context = { env: {}, db: {}, session: { user } };
    const data = { postId: 7 };
    await (getRootCommentsByTargetFn as unknown as Handler)({ context, data });
    expect(mocks.createViewerAccess).toHaveBeenCalledWith(
      context.env,
      user,
      cookie,
    );
    expect(mocks.roots).toHaveBeenCalledWith(
      { ...context, viewer },
      { ...data, viewerId: user.id },
    );
  });
});
