import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import theme from "@theme";
import { toast } from "sonner";
import { useCallback } from "react";
import { MOMENTS_KEYS, publicMomentsQuery } from "@/features/moments/queries";
import { textToJsonContent } from "@/features/moments/moments.service";
import {
  addMomentCommentFn,
  toggleMomentLikeFn,
} from "@/features/moments/api/moments.user.api";
import {
  createMomentFn,
  deleteMomentFn,
} from "@/features/moments/api/moments.admin.api";
import { authClient } from "@/lib/auth/auth.client";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_public/moments")({
  component: MomentsPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(publicMomentsQuery());

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
  const { data: moments } = useSuspenseQuery(publicMomentsQuery());
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: MOMENTS_KEYS.list });
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

  const onAddComment = useCallback(
    async (momentId: number, text: string): Promise<boolean> => {
      try {
        const result = await addMomentCommentFn({ data: { momentId, text } });
        if (result.error) {
          toast.error(m.moments_comment_error());
          return false;
        }
        await refresh();
        return true;
      } catch {
        toast.error(m.moments_comment_error());
        return false;
      }
    },
    [refresh],
  );

  const onCreateMoment = useCallback(
    async (content: string, images: string[]): Promise<boolean> => {
      try {
        const result = await createMomentFn({
          data: {
            content: textToJsonContent(content),
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

  return (
    <theme.MomentsPage
      moments={moments}
      isAdmin={session?.user.role === "admin"}
      currentUserId={session?.user.id ?? null}
      onToggleLike={onToggleLike}
      onAddComment={onAddComment}
      onCreateMoment={onCreateMoment}
      onDeleteMoment={onDeleteMoment}
    />
  );
}
