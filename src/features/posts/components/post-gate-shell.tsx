import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import AccessGateDialog, {
  type AccessGateError,
  type AccessGateMode,
} from "@/components/common/access-gate-dialog";
import { getGateResponseError, getGateRetryDelayMs } from "@/components/common/gate-dialog/gate-response";
import { postBySlugQuery } from "@/features/posts/queries";
import type { PostWithToc } from "@/features/posts/schema/posts.schema";
import { useNavigateBack } from "@/hooks/use-navigate-back";

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
 * - 私密门禁：仅展示说明，前台不提供绕过渠道（可读权限由服务端判断）。
 * - 关闭/返回：点击关闭按钮或「返回上一步」时调用 useNavigateBack 返回上一页。
 */
export function PostGateShell({ post }: PostGateShellProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<AccessGateError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const retryUntil = useRef(0);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  const isCoolingDown = retryAfterSeconds > 0;
  useEffect(() => {
    if (!isCoolingDown) return;
    const timer = setInterval(() => {
      setRetryAfterSeconds(Math.max(0, Math.ceil((retryUntil.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [isCoolingDown]);
  const handleBack = useNavigateBack({ fallbackTo: "/posts" });

  if (!post.gate) return null;

  const mode: AccessGateMode =
    post.gate === "password" ? "password" : "private";

  const handleSubmitPassword = async (password: string) => {
    if (submittingRef.current || Date.now() < retryUntil.current) return;
    submittingRef.current = true;
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
        // A successful verification is not proof that the unlock cookie worked.
        // Cancel an older gate request and require a fresh, ungated article.
        const query = postBySlugQuery(post.slug);
        await queryClient.cancelQueries({ queryKey: query.queryKey, exact: true });
        await queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: "none" });
        const unlockedPost = await queryClient.fetchQuery({ ...query, staleTime: 0 });
        if (!unlockedPost) setError("postNotFound");
        else if (unlockedPost.gate) setError("generic");
        else {
          await queryClient.invalidateQueries({ queryKey: ["pageview"] });
        }
        return;
      }

      const payload: unknown = await res.json().catch(() => null);
      const responseError = getGateResponseError(payload);
      setError(responseError);
      if (responseError === "rateLimited") {
        const delay = getGateRetryDelayMs(res.headers.get("Retry-After"), payload);
        retryUntil.current = Date.now() + delay;
        setRetryAfterSeconds(Math.ceil(delay / 1000));
      }
    } catch {
      setError("generic");
    } finally {
      submittingRef.current = false;
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
      retryAfterSeconds={retryAfterSeconds}
      isSubmitting={isSubmitting}
      onSubmitPassword={mode === "password" ? handleSubmitPassword : undefined}
      onOpenChange={() => {
        // 门禁关闭：返回上一步（点击关闭按钮或「返回上一步」时触发）。
        handleBack();
      }}
    />
  );
}
