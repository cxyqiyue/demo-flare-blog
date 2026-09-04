import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import AccessGateDialog, {
  type AccessGateError,
  type AccessGateMode,
} from "@/components/common/access-gate-dialog";
import { useNavigateBack } from "@/hooks/use-navigate-back";
import { postBySlugQuery } from "@/features/posts/queries";
import type { PostWithToc } from "@/features/posts/schema/posts.schema";

const VERIFY_PASSWORD_URL = "/api/post/verify-password";

interface PostGateShellProps {
  post: Exclude<PostWithToc, null>;
}

/**
 * 受限文章的毛玻璃门禁壳。
 * - 当 post.gate 非空（未解锁）时挂载 AccessGateDialog 覆盖前台，
 *   叠加大面积背景模糊以遮蔽正文，绝不在壳内泄露正文。
 * - 密码门禁：表单提交 → POST /api/post/verify-password，服务端签发解锁 cookie
 *   （Set-Cookie）；成功后再重拉文章查询，使 gate 归 null、正文露出并卸载遮罩。
 * - 私密门禁：仅展示说明，前台不提供绕过渠道（私密文章只对 admin 可读）。
 * - 关闭/返回：点击关闭按钮或「返回上一步」时调用 useNavigateBack 返回上一页。
 */
export function PostGateShell({ post }: PostGateShellProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<AccessGateError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleBack = useNavigateBack({ fallbackTo: "/posts" });

  if (!post.gate) return null;

  const mode: AccessGateMode =
    post.gate === "password" ? "password" : "private";

  const handleSubmitPassword = async (password: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(VERIFY_PASSWORD_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: post.slug, password }),
      });

      if (res.ok) {
        // 解锁 cookie 已由服务端 Set-Cookie 落盘。
        // 主动失效并重拉文章查询，确保正文露出、卸载遮罩。
        await queryClient.invalidateQueries({
          queryKey: ["posts", "detail", post.slug],
        });
        await queryClient.fetchQuery(postBySlugQuery(post.slug));
        return;
      }

      if (res.status === 401) {
        setError("wrongPassword");
      } else if (res.status === 429) {
        setError("rateLimited");
      } else if (res.status === 404) {
        setError("invalidLink");
      } else {
        setError("generic");
      }
    } catch {
      setError("generic");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessGateDialog
      open
      mode={mode}
      title={post.title}
      channel={post.passwordChannel}
      hint={post.passwordHint}
      error={error}
      isSubmitting={isSubmitting}
      onSubmitPassword={mode === "password" ? handleSubmitPassword : undefined}
      onOpenChange={() => {
        // 门禁关闭：返回上一步（点击关闭按钮或「返回上一步」时触发）。
        handleBack();
      }}
    />
  );
}
