import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { LoginPage } from "../pages/login";
import { RegisterPage } from "../pages/register";
import {
  registerAccount,
  registerPasswordAccount,
  loginWithPassword,
  logoutAccount,
  sessionQuery,
  switchAccount,
} from "../entities/session";
import { ApiError, request, setCsrfToken } from "../shared/api/client";
import type { DemoAccount, UserProfileDto } from "../shared/api/types";
import { sessionReturn } from "../shared/lib/session-return";
import { resetMockSession } from "../mocks/handlers";
import { server } from "./setup";

function SessionObserver() {
  const session = useQuery(sessionQuery);
  return (
    <div data-testid="shell-session">{session.data?.user.displayName}</div>
  );
}

function Destination() {
  const session = useQuery(sessionQuery);
  const location = useLocation();
  return (
    <>
      <h1>{session.data?.user.displayName}</h1>
      <p>
        {location.pathname}
        {location.search}
        {location.hash}
      </p>
    </>
  );
}
function mount(path = "/register", state?: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["private", "previous-user"], { secret: "previous" });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: path.split("?")[0],
            search: path.includes("?") ? "?" + path.split("?")[1] : "",
            state,
          },
        ]}
      >
        <SessionObserver />
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
async function fill(nickname = "new-runner", displayName = "Новый участник") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Никнейм"), nickname);
  await user.type(screen.getByLabelText("Имя в профиле"), displayName);
  await user.type(screen.getByLabelText("Пароль"), "valid-password");
  return user;
}

describe("new account signup", () => {
  it("creates a separate USER, clears private cache, installs CSRF and returns to the requested action", async () => {
    const original = await switchAccount("user-alex");
    setCsrfToken(original.csrfToken);
    const client = mount("/register?next=create-event");
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));
    await screen.findByRole("heading", { name: "Новый участник" });
    expect(screen.getByText("/events/new")).toBeInTheDocument();
    expect(screen.getByTestId("shell-session")).toHaveTextContent(
      "Новый участник",
    );
    expect(client.getQueryData(["private", "previous-user"])).toBeUndefined();
    const session = client.getQueryData(sessionQuery.queryKey)!;
    expect(session.user.id).not.toBe(original.user.id);
    expect(session.systemRoles).toEqual(["USER"]);
    expect(session.user.ratingPoints).toBe(0);
    const updated = await request<UserProfileDto>("/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ bio: "CSRF работает" }),
    });
    expect(updated.bio).toBe("CSRF работает");
    expect(
      (await request<UserProfileDto>(`/users/${original.user.id}`)).displayName,
    ).toBe(original.user.displayName);
  });

  it("retains fields after a nickname conflict and allows correction", async () => {
    mount();
    const user = await fill("USER-ALEX");
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Никнейм уже занят",
    );
    expect(screen.getByLabelText("Имя в профиле")).toHaveValue(
      "Новый участник",
    );
    expect(screen.getByLabelText("Никнейм")).toHaveFocus();
    await user.clear(screen.getByLabelText("Никнейм"));
    await user.type(screen.getByLabelText("Никнейм"), "another-user");
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));
    await screen.findByRole("heading", { name: "Новый участник" });
    expect(screen.getByText("/profile")).toBeInTheDocument();
  });

  it("keeps the map context across signup", async () => {
    mount("/register?next=map", {
      mapReturn: "/map?lat=53.2&lng=50.1&zoom=15&venues=off",
    });
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));
    await screen.findByRole("heading", { name: "Новый участник" });
    expect(
      screen.getByText("/map?lat=53.2&lng=50.1&zoom=15&venues=off"),
    ).toBeInTheDocument();
  });

  it.each([400, 404, 500])(
    "reports HTTP %s without claiming success or losing the form",
    async (status) => {
      server.use(
        http.post("/api/v1/auth/register", () =>
          HttpResponse.json(
            { code: "VALIDATION_ERROR", message: "Ошибка", details: [] },
            { status },
          ),
        ),
      );
      mount();
      const user = await fill();
      await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));
      await screen.findByRole("alert");
      expect(screen.getByLabelText("Никнейм")).toHaveValue("new-runner");
      expect(
        screen.getByRole("button", { name: "Создать аккаунт" }),
      ).toBeEnabled();
      expect(screen.queryByText("/profile")).not.toBeInTheDocument();
    },
  );

  it("keeps a new mock user available after session reset and a nickname change", async () => {
    const session = await registerAccount({
      nickname: "persistent-user",
      displayName: "Постоянный участник",
    });
    setCsrfToken(session.csrfToken);
    const accounts = await request<DemoAccount[]>("/demo/accounts");
    const account = accounts.find(
      (item) => item.label === "Постоянный участник",
    )!;
    await request("/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ nickname: "changed-handle" }),
    });
    resetMockSession();
    setCsrfToken();
    const restored = await switchAccount(account.id);
    expect(restored.user.id).toBe(session.user.id);
    expect(restored.user.nickname).toBe("changed-handle");
    expect(
      (await request<UserProfileDto>(`/users/${session.user.id}`)).nickname,
    ).toBe("changed-handle");
    await expect(
      registerAccount({ nickname: "CHANGED-HANDLE", displayName: "Дубликат" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("validates blank names without sending a signup request", async () => {
    let calls = 0;
    server.use(
      http.post("/api/v1/auth/register", () => {
        calls++;
        return HttpResponse.error();
      }),
    );
    mount();
    const user = await fill("ab", "   ");
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Никнейм")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(calls).toBe(0);
  });
});

it("does not turn arbitrary return parameters into external redirects", () => {
  expect(
    sessionReturn(new URLSearchParams("next=https://evil.example"), {
      mapReturn: "//evil.example",
    }).to,
  ).toBe("/");
  expect(
    sessionReturn(
      new URLSearchParams("next=join-event&eventId=../../evil"),
      null,
    ).to,
  ).toBe("/");
  expect(sessionReturn(new URLSearchParams("next=profile"), null).to).toBe(
    "/profile",
  );
});

it("password accounts cannot use demo login; credentials survive rename and are never stored as plaintext", async () => {
  const session = await registerPasswordAccount({
    nickname: "@private-user",
    displayName: "Личный аккаунт",
    password: "valid-password",
  });
  setCsrfToken(session.csrfToken);
  expect(
    (await request<DemoAccount[]>("/demo/accounts")).some(
      (a) => a.label === "Личный аккаунт",
    ),
  ).toBe(false);
  await expect(
    switchAccount(`signup-${session.user.id}`),
  ).rejects.toBeInstanceOf(ApiError);
  expect(JSON.stringify(localStorage)).not.toContain("valid-password");
  await request("/me/profile", {
    method: "PATCH",
    body: JSON.stringify({ nickname: "renamed-private" }),
  });
  resetMockSession();
  await expect(
    loginWithPassword({
      nickname: "renamed-private",
      password: "wrong-password",
    }),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    (
      await loginWithPassword({
        nickname: "@renamed-private",
        password: "valid-password",
      })
    ).user.id,
  ).toBe(session.user.id);
  await logoutAccount();
  await expect(request("/session")).rejects.toBeInstanceOf(ApiError);
});

it("password login stays available when demo accounts are disabled", async () => {
  await registerPasswordAccount({
    nickname: "no-demo-user",
    displayName: "Без деморежима",
    password: "valid-password",
  });
  resetMockSession();
  setCsrfToken();
  server.use(
    http.get("/api/v1/demo/accounts", () =>
      HttpResponse.json(
        { code: "NOT_FOUND", message: "Отключено" },
        { status: 404 },
      ),
    ),
  );
  mount("/login?next=profile");
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Никнейм"), "@no-demo-user");
  await user.type(screen.getByLabelText("Пароль"), "valid-password");
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "Демо-вход" }),
    ).not.toBeInTheDocument(),
  );
  await user.click(screen.getByRole("button", { name: "Войти" }));
  await screen.findByRole("heading", { name: "Без деморежима" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
