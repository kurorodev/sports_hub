import { queryOptions } from "@tanstack/react-query";
import { ApiError, request, setCsrfToken } from "../../../shared/api/client";
import type { DemoAccount, Session } from "../../../shared/api/types";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async ({ signal }): Promise<Session | null> => {
    try {
      const session = await request<Session>("/session", { signal });
      setCsrfToken(session.csrfToken);
      return session;
    } catch (error) {
      setCsrfToken();
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  retry: false,
});

export const demoAccountsQuery = queryOptions({
  queryKey: ["demo-accounts"],
  queryFn: ({ signal }) => request<DemoAccount[]>("/demo/accounts", { signal }),
});

export function switchAccount(accountId: string) {
  return request<Session>("/demo/session", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  });
}
