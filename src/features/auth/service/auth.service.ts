import { isSuperAdmin } from "@/lib/auth/access";
import * as AuthRepo from "@/features/auth/data/auth.data";
import * as ConfigService from "@/features/config/service/config.service";

export type EnrichedSessionUser = Session["user"] & { isSuperAdmin: boolean };
export type EnrichedSession = Omit<Session, "user"> & {
  user: EnrichedSessionUser;
};

export async function getSession(
  context: SessionContext,
): Promise<EnrichedSession | null> {
  const session = context.session;
  if (!session) return null;

  return {
    ...session,
    user: {
      ...session.user,
      isSuperAdmin: isSuperAdmin(session.user, context.env),
    },
  };
}

export async function userHasPassword(context: AuthContext) {
  return await AuthRepo.userHasPassword(context.db, context.session.user.id);
}

export async function getIsEmailConfigured(
  context: DbContext & { executionCtx: ExecutionContext },
) {
  const config = await ConfigService.getSystemConfig(context);
  return !!(
    config?.email?.host &&
    config.email.username &&
    config.email.password &&
    config.email.senderAddress
  );
}
