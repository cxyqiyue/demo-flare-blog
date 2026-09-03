import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { isAdmin, isSuperAdmin } from "@/lib/auth/access";
import { dbMiddleware, sessionMiddleware } from "@/lib/middlewares";
import * as NavigationService from "../navigation.service";

/**
 * 解析前台导航页访客的 owner 作用域：
 * - 非管理员（匿名/普通用户）：ownerId=null，由 service 回退到超管账号数据。
 * - 管理员/超管：ownerId=本人 id（含遗留数据，仅超管本人）。
 * 该中间件只负责解析，服务层以其结果决定最终数据来源与缓存键。
 */
const navigationViewerMiddleware = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    const session = context.session;

    let viewerOwner:
      | { ownerId: string | null; includeLegacy: boolean }
      | undefined;

    if (session && isAdmin(session.user, context.env)) {
      const ownerId = session.user.id;
      const includeLegacy = isSuperAdmin(session.user, context.env);
      viewerOwner = { ownerId, includeLegacy };
    }
    // 非管理员：不注入 viewerOwner，由服务层回退解析超管账号

    return next({ context: { viewerOwner } });
  });

export const getNavigationPublicDataFn = createServerFn()
  .middleware([dbMiddleware, navigationViewerMiddleware])
  .handler(async ({ context }) => {
    return await NavigationService.getNavigationPublicData(context);
  });
