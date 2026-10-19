import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { setCsrfToken } from "../../../shared/api/client";
import type { Session } from "../../../shared/api/types";
import { sessionReturn } from "../../../shared/lib/session-return";
import { sessionQuery } from "../api/session";

export function useSessionTransition(
  params: URLSearchParams,
  state: unknown,
  fallback = "/",
) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return async (session: Session) => {
    await client.cancelQueries();
    client.clear();
    setCsrfToken(session.csrfToken);
    client.setQueryData(sessionQuery.queryKey, session);
    const destination = sessionReturn(params, state, fallback);
    navigate(destination.to, { replace: true, state: destination.state });
  };
}
