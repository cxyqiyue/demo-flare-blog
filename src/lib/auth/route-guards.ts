import { redirect } from "@tanstack/react-router";
import { sessionQuery } from "@/features/auth/queries";

/**
 * 超级管理员专用后台页面的路由守卫。
 * 普通管理员在后台只保留文章管理、导航管理；其余后台页面仅超管可访问，
 * 非超管访问时重定向回仪表盘。
 */
export async function requireSuperAdminRoute({
  context,
}: {
  context: { queryClient: import("@tanstack/react-query").QueryClient };
}) {
  const session = await context.queryClient.ensureQueryData(sessionQuery);
  if (!session) {
    throw redirect({ to: "/login" });
  }
  if (session.user.isSuperAdmin !== true) {
    throw redirect({ to: "/admin" });
  }
  return { session };
}
