import { createAuthMiddleware } from "@better-auth/core/api";
import { APIError } from "@better-auth/core/error";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthEmail } from "@/features/email/templates/AuthEmail";
import { seedAdminNavigationOnFirstLogin } from "@/features/navigation/navigation.service";
import { createAuthConfig } from "@/lib/auth/auth.config";
import { resolveGravatarEmailAvatar } from "@/lib/auth/gravatar";
import * as authSchema from "@/lib/db/schema/auth.table";
import { user } from "@/lib/db/schema";
import { serverEnv } from "@/lib/env/server.env";
import type { Locale } from "@/lib/i18n";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

async function checkEmailRateLimit(
  env: Env,
  scope: string,
  email: string,
): Promise<boolean> {
  const identifier = `${scope}:${email.toLowerCase().trim()}`;
  const id = env.RATE_LIMITER.idFromName(identifier);
  const rateLimiter = env.RATE_LIMITER.get(id);
  const result = await rateLimiter.checkLimit({
    capacity: 3,
    interval: "1h",
  });
  return result.allowed;
}

export function getAuth({ db, env }: { db: DB; env: Env }) {
  const {
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL,
    ADMIN_EMAIL,
    LOCALE,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
  } = serverEnv(env);

  // 固定 10 个 DO 实例池，随机选择避免冷启动
  const PASSWORD_HASHER_POOL_SIZE = 10;
  function getPasswordHasher() {
    const index = Math.floor(Math.random() * PASSWORD_HASHER_POOL_SIZE);
    const id = env.PASSWORD_HASHER.idFromName(`hasher-${index}`);
    return env.PASSWORD_HASHER.get(id);
  }

  function getAuthEmailLocale(): Locale {
    try {
      return getLocale();
    } catch {
      return LOCALE;
    }
  }

  /**
   * 登录时按需同步超级管理员身份：
   * - 仅当用户邮箱与 ADMIN_EMAIL 一致（大小写不敏感）且数据库 role 非 admin 时才写入，
   *   正常登录只读不写，避免不必要的数据库压力。
   * - 解决：数据库 role 被误改 / 首次注册钩子未生效后，无需删除 Workers / D1 重新部署，
   *   重新登录即可自动恢复超级管理员权限。
   */
  async function syncSuperAdminRole(sessionUserId: string) {
    try {
      const [found] = await db
        .select({ email: user.email, role: user.role })
        .from(user)
        .where(eq(user.id, sessionUserId))
        .limit(1);
      if (!found) return;

      if (
        found.email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase() &&
        found.role !== "admin"
      ) {
        await db
          .update(user)
          .set({ role: "admin" })
          .where(eq(user.id, sessionUserId));
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "syncSuperAdminRole failed",
          sessionUserId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  function isAdminEmail(email: string): boolean {
    return email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
  }

  /**
   * 邮箱账号登录后按需同步头像：
   * - 仅当用户 image 为空（邮箱注册账号没有头像）时，尝试用邮箱的
   *   Gravatar 头像回填，避免覆盖用户手动设置的头像，也避免重复网络请求。
   * - 只有该邮箱确实存在 Gravatar 真实头像时才写库；否则保持空，
   *   前端继续显示首字母/图标 fallback。
   * - GitHub OAuth 登录的头像由 better-auth 内置自动写入，此处不会覆盖。
   */
  async function syncEmailAvatarOnLogin(sessionUserId: string) {
    try {
      const [found] = await db
        .select({ email: user.email, image: user.image })
        .from(user)
        .where(eq(user.id, sessionUserId))
        .limit(1);
      if (!found || found.email.trim() === "" || (found.image ?? "").trim() !== "") {
        return;
      }
      const avatar = await resolveGravatarEmailAvatar(found.email, {
        size: 256,
      });
      if (!avatar) return;
      await db
        .update(user)
        .set({ image: avatar })
        .where(eq(user.id, sessionUserId));
    } catch (error) {
      // 头像同步失败不应影响登录流程。
      console.error(
        JSON.stringify({
          message: "syncEmailAvatarOnLogin failed",
          sessionUserId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return betterAuth({
    ...createAuthConfig(),
    socialProviders: {
      github: {
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;

        const email =
          typeof ctx.body?.email === "string" ? ctx.body.email.trim() : "";
        if (!email) return;

        const allowed = await checkEmailRateLimit(env, "email-signup", email);
        if (allowed) return;

        throw APIError.from("BAD_REQUEST", {
          code: "RATE_LIMITED",
          message: "Too many sign up attempts",
        });
      }),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: {
        hash: (password: string) => getPasswordHasher().hash(password),
        verify: (params: { hash: string; password: string }) =>
          getPasswordHasher().verify(params),
      },
      sendResetPassword: async ({ user, url }) => {
        // Per-email rate limit: 3 per hour — silently skip if exceeded
        const allowed = await checkEmailRateLimit(
          env,
          "email-reset",
          user.email,
        );
        if (!allowed) return;

        const locale = getAuthEmailLocale();
        const emailHtml = renderToStaticMarkup(
          AuthEmail({ locale, type: "reset-password", url }),
        );

        await env.QUEUE.send({
          type: "EMAIL",
          data: {
            to: user.email,
            subject: m.email_auth_reset_subject({}, { locale }),
            html: emailHtml,
          },
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        // Per-email rate limit: 3 per hour — silently skip if exceeded
        const allowed = await checkEmailRateLimit(
          env,
          "email-verify",
          user.email,
        );
        if (!allowed) return;

        const locale = getAuthEmailLocale();
        const emailHtml = renderToStaticMarkup(
          AuthEmail({ locale, type: "verification", url }),
        );

        await env.QUEUE.send({
          type: "EMAIL",
          data: {
            to: user.email,
            subject: m.email_auth_verification_subject({}, { locale }),
            html: emailHtml,
          },
        });
      },
      autoSignInAfterVerification: true,
    },
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (isAdminEmail(user.email)) {
              return { data: { ...user, role: "admin" } };
            }
            return { data: user };
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await syncSuperAdminRole(session.userId);
            // 首次登录时初始化管理员账号的导航搜索引擎（从超管复制，幂等）
            await seedAdminNavigationOnFirstLogin(
              { db, env },
              session.userId,
            );
            // 邮箱账号登录后自动回填 Gravatar 头像（image 为空时才写库）
            await syncEmailAvatarOnLogin(session.userId);
          },
        },
      },
    },
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
  });
}

export type Auth = ReturnType<typeof getAuth>;
export type Session = Auth["$Infer"]["Session"];
