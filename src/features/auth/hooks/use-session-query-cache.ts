import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { authClient } from "@/lib/auth/auth.client";
import {
  clearSessionQueries,
  isSessionTransitionPending,
  observeSessionIdentity,
  sessionQueryIdentity,
} from "../session-query-cache";

export function useSessionQueryCache() {
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const identity = sessionQueryIdentity(session?.user);

  useEffect(() => {
    if (isPending) return;
    const changed = observeSessionIdentity(queryClient, identity);
    if (!changed || isSessionTransitionPending(queryClient)) return;

    // Also cover session expiry and changes made in another browser tab.
    // Reload discards router loaderData and mounted private article/comment
    // state, not just the React Query entries.
    void clearSessionQueries(queryClient).then(() => window.location.reload());
  }, [identity, isPending, queryClient]);
}
