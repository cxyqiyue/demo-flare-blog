import { serverEnv } from "@/lib/env/server.env";

/**
 * 超级管理员由 ADMIN_EMAIL（必填 Secrets）在运行时派生，而非依赖数据库 role 字段。
 * 这样即使数据库中的 role 被误改 / 未同步，持有 ADMIN_EMAIL 邮箱的账号始终具有超管权限，
 * 无需删除 Workers / D1 重新部署即可恢复。
 */
export function isSuperAdmin(
  user: { email: string },
  env: Env,
): boolean {
  const { ADMIN_EMAIL } = serverEnv(env);
  return user.email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
}

/**
 * 是否为管理员（含超级管理员）。超级管理员（ADMIN_EMAIL 持有者）在运行时恒为管理员，
 * 不受数据库 role 字段影响。
 */
export function isAdmin(
  user: { email: string; role?: string | null },
  env: Env,
): boolean {
  return user.role === "admin" || isSuperAdmin(user, env);
}
