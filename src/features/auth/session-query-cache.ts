import type { Query, QueryClient } from "@tanstack/react-query";

// All of these responses may contain data that depends on the current viewer.
const SESSION_QUERY_ROOTS = new Set([
  "auth",
  "posts",
  "comments",
  "search",
  "pageview",
  "dashboard",
]);

const pendingTransitions = new WeakMap<QueryClient, number>();
const sessionIdentities = new WeakMap<QueryClient, string | null>();
const expectedIdentities = new WeakMap<QueryClient, string | null>();

export function sessionQueryIdentity(
  user: { id: string; role?: string | null } | null | undefined,
) {
  return user ? JSON.stringify([user.id, user.role ?? "user"]) : null;
}

export function isSessionQuery(query: Query) {
  return SESSION_QUERY_ROOTS.has(String(query.queryKey[0]));
}

export async function clearSessionQueries(queryClient: QueryClient) {
  // Stop old requests before removing their results so they cannot repopulate
  // the next viewer's cache, including requests that ignore the abort signal.
  await queryClient.cancelQueries({ predicate: isSessionQuery });
  queryClient.removeQueries({ predicate: isSessionQuery });
}

export function isSessionTransitionPending(queryClient: QueryClient) {
  return (pendingTransitions.get(queryClient) ?? 0) > 0;
}

export function observeSessionIdentity(
  queryClient: QueryClient,
  identity: string | null,
) {
  // Better Auth may publish its session atom after the action has returned.
  // Ignore intermediate old values from our own action until its expected
  // identity arrives, preserving the local login/logout success feedback.
  if (expectedIdentities.has(queryClient)) {
    if (identity === expectedIdentities.get(queryClient)) {
      expectedIdentities.delete(queryClient);
    }
    return false;
  }
  const hadIdentity = sessionIdentities.has(queryClient);
  const previousIdentity = sessionIdentities.get(queryClient);
  sessionIdentities.set(queryClient, identity);
  return hadIdentity && previousIdentity !== identity;
}

export async function runSessionTransition<T extends { error?: unknown }>(
  queryClient: QueryClient,
  changeSession: () => Promise<T>,
  nextIdentity: (result: T) => string | null = () => null,
): Promise<T> {
  pendingTransitions.set(
    queryClient,
    (pendingTransitions.get(queryClient) ?? 0) + 1,
  );
  try {
    // Never clear data while sign-in/sign-out is still using the old session,
    // or when the server rejected the change.
    const result = await changeSession();
    if (!result.error) {
      await clearSessionQueries(queryClient);
      const identity = nextIdentity(result);
      if (
        !sessionIdentities.has(queryClient) ||
        sessionIdentities.get(queryClient) !== identity
      ) {
        expectedIdentities.set(queryClient, identity);
      } else {
        expectedIdentities.delete(queryClient);
      }
      sessionIdentities.set(queryClient, identity);
    }
    return result;
  } finally {
    const remaining = (pendingTransitions.get(queryClient) ?? 1) - 1;
    if (remaining > 0) pendingTransitions.set(queryClient, remaining);
    else pendingTransitions.delete(queryClient);
  }
}
