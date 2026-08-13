import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { CommentStatus } from "@/lib/db/schema";
import { getAllCommentsFn } from "../api/comments.admin.api";
import {
  getMyCommentsFn,
  getRepliesByRootIdFn,
  getRootCommentsByTargetFn,
} from "../api/comments.public.api";

export type CommentTargetInput = {
  postId?: number;
  momentId?: number;
  aboutArticleId?: number;
};

function targetKey(target: CommentTargetInput) {
  if (target.aboutArticleId != null) return `a${target.aboutArticleId}`;
  if (target.momentId != null) return `m${target.momentId}`;
  return `p${target.postId}`;
}

export const COMMENTS_KEYS = {
  all: ["comments"] as const,

  // Parent keys (static arrays for prefix invalidation)
  mine: ["comments", "mine"] as const,
  admin: ["comments", "admin"] as const,

  // Child keys (functions for specific queries)
  roots: (target: CommentTargetInput) =>
    ["comments", "roots", targetKey(target)] as const,
  replies: (target: CommentTargetInput, rootId: number) =>
    ["comments", "replies", targetKey(target), rootId] as const,
  repliesLists: (target: CommentTargetInput) =>
    ["comments", "replies", targetKey(target)] as const,
  userStats: (userId: string) =>
    ["comments", "admin", "user-stats", userId] as const,
};

export function rootCommentsByTargetQuery(
  target: CommentTargetInput,
  userId?: string,
) {
  return queryOptions({
    queryKey: [...COMMENTS_KEYS.roots(target), { userId }],
    queryFn: () => getRootCommentsByTargetFn({ data: { ...target } }),
  });
}

export function rootCommentsByTargetInfiniteQuery(
  target: CommentTargetInput,
  userId?: string,
) {
  return infiniteQueryOptions({
    queryKey: [...COMMENTS_KEYS.roots(target), "infinite", { userId }],
    queryFn: ({ pageParam = 0 }) =>
      getRootCommentsByTargetFn({
        data: { ...target, offset: pageParam, limit: 20 },
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce(
        (sum, page) => sum + page.items.length,
        0,
      );
      return totalLoaded < lastPage.total ? totalLoaded : undefined;
    },
  });
}

export function repliesByRootIdInfiniteQuery(
  target: CommentTargetInput,
  rootId: number,
  userId?: string,
) {
  return infiniteQueryOptions({
    queryKey: [...COMMENTS_KEYS.replies(target, rootId), { userId }],
    queryFn: ({ pageParam = 0 }) =>
      getRepliesByRootIdFn({
        data: { ...target, rootId, offset: pageParam, limit: 20 },
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce(
        (sum, page) => sum + page.items.length,
        0,
      );
      return totalLoaded < lastPage.total ? totalLoaded : undefined;
    },
  });
}

export function myCommentsQuery(
  options: { offset?: number; limit?: number; status?: CommentStatus } = {},
) {
  return queryOptions({
    queryKey: [...COMMENTS_KEYS.mine, options],
    queryFn: () => getMyCommentsFn({ data: options }),
  });
}

export function allCommentsQuery(
  options: {
    offset?: number;
    limit?: number;
    status?: CommentStatus;
    postId?: number;
    momentId?: number;
    aboutArticleId?: number;
    userId?: string;
    userName?: string;
  } = {},
) {
  return queryOptions({
    queryKey: [...COMMENTS_KEYS.admin, options],
    queryFn: () => getAllCommentsFn({ data: options }),
  });
}
