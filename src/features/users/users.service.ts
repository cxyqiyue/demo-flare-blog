import { isSuperAdmin } from "@/lib/auth/access";
import { err, ok, type Result } from "@/lib/errors";
import * as UserRepo from "./data/users.data";
import type {
  BanUserInput,
  GetUsersInput,
  GetUsersResponse,
  SetUserRoleInput,
  UnbanUserInput,
  UserManageError,
} from "./users.schema";

function getActorInfo(user: { email: string; role?: string | null }) {
  return {
    email: user.email,
    role: user.role,
  };
}

// ============ Admin Methods ============

export async function listUsers(
  context: AdminContext,
  input: GetUsersInput,
): Promise<GetUsersResponse> {
  const actor = getActorInfo(context.session.user);

  const [items, total] = await Promise.all([
    UserRepo.getAllUsers(context.db, input),
    UserRepo.getUsersCount(context.db, input.search),
  ]);

  const mapped = items.map((userItem) => ({
    ...userItem,
    banned: !!userItem.banned,
    isSuperAdmin: isSuperAdmin(userItem, context.env),
  }));

  return {
    items: mapped,
    total,
    currentUser: {
      id: context.session.user.id,
      email: actor.email,
      role: actor.role ?? null,
      isSuperAdmin: isSuperAdmin(actor, context.env),
    },
  };
}

export async function setUserRole(
  context: AdminContext,
  input: SetUserRoleInput,
): Promise<Result<{ userId: string; role: string | null }, UserManageError>> {
  const actor = context.session.user;
  const actorIsSuper = isSuperAdmin(actor, context.env);

  const target = await UserRepo.getUserById(context.db, input.userId);
  if (!target) {
    return err({ reason: "NOT_FOUND" });
  }

  const targetIsSuper = isSuperAdmin(target, context.env);

  if (targetIsSuper) {
    return err({ reason: "PROTECTED_USER" });
  }

  if (!actorIsSuper) {
    if (input.role === "admin" || target.role === "admin") {
      return err({ reason: "PERMISSION_DENIED" });
    }
  }

  const nextRole = input.role === "admin" ? "admin" : null;
  await UserRepo.setUserRole(context.db, target.id, nextRole);

  return ok({ userId: target.id, role: nextRole });
}

export async function banUser(
  context: AdminContext,
  input: BanUserInput,
): Promise<Result<{ userId: string }, UserManageError>> {
  const actor = context.session.user;
  const actorIsSuper = isSuperAdmin(actor, context.env);

  const target = await UserRepo.getUserById(context.db, input.userId);
  if (!target) {
    return err({ reason: "NOT_FOUND" });
  }

  const targetIsSuper = isSuperAdmin(target, context.env);
  if (targetIsSuper) {
    return err({ reason: "PROTECTED_USER" });
  }

  if (!actorIsSuper && target.role === "admin") {
    return err({ reason: "PERMISSION_DENIED" });
  }

  await UserRepo.setUserBan(context.db, target.id, true, input.reason ?? null);

  return ok({ userId: target.id });
}

export async function unbanUser(
  context: AdminContext,
  input: UnbanUserInput,
): Promise<Result<{ userId: string }, UserManageError>> {
  const actor = context.session.user;
  const actorIsSuper = isSuperAdmin(actor, context.env);

  const target = await UserRepo.getUserById(context.db, input.userId);
  if (!target) {
    return err({ reason: "NOT_FOUND" });
  }

  const targetIsSuper = isSuperAdmin(target, context.env);
  if (targetIsSuper) {
    return err({ reason: "PROTECTED_USER" });
  }

  if (!actorIsSuper && target.role === "admin") {
    return err({ reason: "PERMISSION_DENIED" });
  }

  await UserRepo.setUserBan(context.db, target.id, false);

  return ok({ userId: target.id });
}
