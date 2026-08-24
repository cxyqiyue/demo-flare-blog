import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import theme from "@theme";
import type { JSONContent } from "@tiptap/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  createMomentFn,
  deleteMomentFn,
  updateMomentFn,
} from "@/features/moments/api/moments.admin.api";
import { toggleMomentLikeFn } from "@/features/moments/api/moments.user.api";
import {
  MOMENTS_KEYS,
  publicMomentsPageQuery,
} from "@/features/moments/queries";
import type { MomentsPageResponse } from "@/features/moments/moments.schema";
import { authClient } from "@/lib/auth/auth.client";
import { m } from "@/paraglide/messages";

const MOMENTS_PER_PAGE = 5;

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  highlightCommentId: z.coerce.number().optional(),
  rootId: z.number().optional(),
});

export const Route = createFileRoute("/_public/moments")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  component: MomentsPage,
  loader: async ({ context, deps }) => {
    const offset = (deps.page - 1) * MOMENTS_PER_PAGE;
    await context.queryClient.ensureQueryData(
      publicMomentsPageQuery({ offset, limit: MOMENTS_PER_PAGE }),
    );

    return {
      title: m.moments_title(),
      description: m.moments_desc(),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title,
      },
      {
        name: "description",
        content: loaderData?.description,
      },
    ],
  }),
  pendingComponent: theme.MomentsPageSkeleton,
});

function MomentsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { page } = Route.useSearch();
  const currentPage = page ?? 1;
  const offset = (currentPage - 1) * MOMENTS_PER_PAGE;

  const { data: pageData } = useSuspenseQuery(
    publicMomentsPageQuery({ offset, limit: MOMENTS_PER_PAGE }),
  );
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

  const pageQueryKey = [...MOMENTS_KEYS.publicPage, offset, MOMENTS_PER_PAGE];

  const onToggleLike = useCallback(
    async (momentId: number): Promise<boolean> => {
      try {
        const result = await toggleMomentLikeFn({ data: { momentId } });
        if (result.error) {
          toast.error(m.moments_like_error());
          return false;
        }
        const { liked, likeCount } = result.data;
        queryClient.setQueryData<MomentsPageResponse>(
          pageQueryKey,
          (old) => {
            if (!old) return old;
            return {
              ...old,
              items: old.items.map((item) =>
                item.id === momentId
                  ? { ...item, isLiked: liked, likeCount }
                  : item,
              ),
            };
          },
        );
        return true;
      } catch {
        toast.error(m.moments_like_error());
        return false;
      }
    },
    [queryClient, pageQueryKey],
  );

  const onCreateMoment = useCallback(
    async (content: JSONContent, images: string[]): Promise<boolean> => {
      try {
        const result = await createMomentFn({
          data: {
            content,
            images,
          },
        });
        if (result.error) {
          toast.error(m.moments_create_error());
          return false;
        }
        // 服务端已在响应前同步轮换缓存 generation，这里立即 refetch
        // 即可拿到最新数据；成功后给出明确反馈
        await queryClient.refetchQueries({
          queryKey: MOMENTS_KEYS.publicPage,
        });
        toast.success(m.moments_create_success());
        return true;
      } catch {
        toast.error(m.moments_create_error());
        return false;
      }
    },
    [queryClient],
  );

  const onDeleteMoment = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const result = await deleteMomentFn({ data: { id } });
        if (result.error) {
          toast.error(m.moments_delete_error());
          return false;
        }
        queryClient.setQueryData<MomentsPageResponse>(
          pageQueryKey,
          (old) => {
            if (!old) return old;
            return {
              ...old,
              items: old.items.filter((item) => item.id !== id),
              total: old.total - 1,
            };
          },
        );
        toast.success(m.moments_delete_success());
        return true;
      } catch {
        toast.error(m.moments_delete_error());
        return false;
      }
    },
    [queryClient, pageQueryKey],
  );

  const onUpdateMoment = useCallback(
    async (
      id: number,
      content: JSONContent,
      images: string[],
    ): Promise<boolean> => {
      try {
        const result = await updateMomentFn({
          data: { id, content, images },
        });
        if (result.error) {
          toast.error(m.moments_update_error());
          return false;
        }
        // 服务端已在响应前同步轮换缓存 generation，这里立即 refetch
        // 即可拿到最新数据；成功后给出明确反馈
        await queryClient.refetchQueries({
          queryKey: MOMENTS_KEYS.publicPage,
        });
        toast.success(m.moments_update_success());
        return true;
      } catch {
        toast.error(m.moments_update_error());
        return false;
      }
    },
    [queryClient],
  );

  const handlePageChange = (nextPage: number) => {
    navigate({
      search: { page: nextPage > 1 ? nextPage : undefined },
    });
  };

  return (
    <theme.MomentsPage
      moments={pageData.items}
      isAdmin={session?.user.role === "admin"}
      onToggleLike={onToggleLike}
      onCreateMoment={onCreateMoment}
      onUpdateMoment={onUpdateMoment}
      onDeleteMoment={onDeleteMoment}
      page={currentPage}
      pageSize={MOMENTS_PER_PAGE}
      total={pageData.total}
      hasPrevPage={pageData.hasPrevPage}
      hasNextPage={pageData.hasNextPage}
      onPageChange={handlePageChange}
    />
  );
}
