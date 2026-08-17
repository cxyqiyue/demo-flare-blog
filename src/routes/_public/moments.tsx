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

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: MOMENTS_KEYS.all });
  }, [queryClient]);

  const onToggleLike = useCallback(
    async (momentId: number): Promise<boolean> => {
      try {
        const result = await toggleMomentLikeFn({ data: { momentId } });
        if (result.error) {
          toast.error(m.moments_like_error());
          return false;
        }
        await refresh();
        return true;
      } catch {
        toast.error(m.moments_like_error());
        return false;
      }
    },
    [refresh],
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
        await refresh();
        return true;
      } catch {
        toast.error(m.moments_create_error());
        return false;
      }
    },
    [refresh],
  );

  const onDeleteMoment = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const result = await deleteMomentFn({ data: { id } });
        if (result.error) {
          toast.error(m.moments_delete_error());
          return false;
        }
        await refresh();
        return true;
      } catch {
        toast.error(m.moments_delete_error());
        return false;
      }
    },
    [refresh],
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
        await refresh();
        return true;
      } catch {
        toast.error(m.moments_update_error());
        return false;
      }
    },
    [refresh],
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
