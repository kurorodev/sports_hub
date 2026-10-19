import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { setCsrfToken } from "../../../shared/api/client";
import type { Session } from "../../../shared/api/types";
import { sessionReturn } from "../../../shared/lib/session-return";
import { sessionQuery } from "../api/session";

export async function replaceSession(
  client: QueryClient,
  session: Session | null,
) {
  await client.cancelQueries();
  // Preserve the observed session query so the shell receives the new identity.
  // Removing it would leave mounted observers attached to a discarded query.
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== "session",
  });
  client.getMutationCache().clear();
  setCsrfToken(session?.csrfToken);
  client.setQueryData(sessionQuery.queryKey, session);
}

export function useSessionTransition(
  params: URLSearchParams,
  state: unknown,
  fallback = "/",
) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return async (session: Session) => {
    await replaceSession(client, session);
    const destination = sessionReturn(params, state, fallback);
    navigate(destination.to, { replace: true, state: destination.state });
  };
}
