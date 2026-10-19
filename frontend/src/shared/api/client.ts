import type { ApiErrorBody } from "./types";

const mode = import.meta.env.VITE_API_MODE ?? "real";
if (mode !== "mock" && mode !== "real")
  throw new Error("VITE_API_MODE должен быть mock или real");
export const apiConfig = {
  mode,
  baseUrl: (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, ""),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public body?: ApiErrorBody,
  ) {
    super(body?.message ?? "Не удалось выполнить запрос");
  }
}

let csrfToken: string | undefined;
export function setCsrfToken(value?: string) {
  csrfToken = value;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (
    ["POST", "PATCH", "DELETE"].includes(method) &&
    ![
      "/demo/session",
      "/demo/accounts",
      "/auth/register",
      "/auth/login",
    ].includes(path) &&
    csrfToken
  ) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  let response: Response;
  try {
    response = await fetch(`${apiConfig.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (error) {
    if (
      init.signal?.aborted ||
      (error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError")
    )
      throw error;
    throw new ApiError(0);
  }
  if (!response.ok) {
    const body: ApiErrorBody | undefined = await response
      .json()
      .catch(() => undefined);
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type HttpClient = typeof request;

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return "Что-то пошло не так. Попробуйте ещё раз.";
  const messages: Record<number, string> = {
    0: "Нет связи с сервером. Проверьте подключение и повторите попытку.",
    400: "Проверьте введённые данные.",
    429: "Слишком много запросов. Подождите и попробуйте снова.",
    401: "Войдите в аккаунт, чтобы продолжить.",
    403: "У этого аккаунта нет доступа к действию.",
    404: "Не удалось найти запрошенные данные.",
    409: "Данные уже изменились. Обновите страницу и повторите действие.",
    422: "Проверьте введённые данные.",
  };
  return (
    messages[error.status] ?? "Сервис временно недоступен. Попробуйте ещё раз."
  );
}
