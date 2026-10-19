import { queryOptions } from "@tanstack/react-query";
import { ApiError, request, setCsrfToken } from "../../../shared/api/client";
import type {
  DemoAccount,
  DemoRegistrationRequest,
  Session,
} from "../../../shared/api/types";

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

export function registerAccount(values: DemoRegistrationRequest) {
  return request<Session>("/demo/accounts", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function registerPasswordAccount(
  values: import("../../../shared/api/types").AuthRegistrationRequest,
) {
  return request<Session>("/auth/register", {
    method: "POST",
    body: JSON.stringify(values),
  });
}
export function loginWithPassword(
  values: import("../../../shared/api/types").AuthLoginRequest,
) {
  return request<Session>("/auth/login", {
    method: "POST",
    body: JSON.stringify(values),
  });
}
export function logoutAccount() {
  return request<void>("/auth/session", { method: "DELETE" });
}
