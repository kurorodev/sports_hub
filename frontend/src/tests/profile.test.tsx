import {
  act,
  within,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { ProfileServices } from "../app/providers";
import { ProfilePage } from "../pages/profile";
import { ProfileSummary, profileKeys } from "../entities/profile";
import { ProfileForm } from "../features/edit-profile";
import { readProfile } from "../entities/profile/api/mappers";
import { switchAccount, sessionQuery } from "../entities/session";
import { request, setCsrfToken } from "../shared/api/client";
import type { Session, UserProfileDto, CommentDto } from "../shared/api/types";
import { makeSession, mockId } from "../mocks/database";
import { resetMockSession } from "../mocks/handlers";
import { server } from "./setup";
async function login(id = "user-alex") {
  const session = await switchAccount(id);
  setCsrfToken(session.csrfToken);
  return session;
}
function mount(ui: React.ReactNode, path = "/profile", session?: Session) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (session) client.setQueryData(sessionQuery.queryKey, session);
  render(
    <ProfileServices>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ProfileServices>,
  );
  return client;
}
const ownPage = () => (
  <Routes>
    <Route path="/profile" element={<ProfilePage own />} />
    <Route path="/users/:userId" element={<ProfilePage />} />
  </Routes>
);

describe("profile HTTP and UI", () => {
  it("shows only active roles and no gamification in the profile", async () => {
    const session = await login();
    mount(ownPage(), "/profile", session);
    await screen.findByRole("heading", { name: session.user.displayName });
    expect(document.querySelector(".profile-rating")).toBeNull();
    expect(screen.queryByText(/очков|Ранг и очки/)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Редактировать профиль" }),
    );
    const roles = screen.getByRole("group", { name: "Спортивные роли" });
    expect(within(roles).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(roles).getByLabelText("Спортсмен")).toBeVisible();
    expect(within(roles).getByLabelText("Организатор спорта")).toBeVisible();
    expect(within(roles).queryByLabelText("Тренер")).not.toBeInTheDocument();
    expect(within(roles).queryByLabelText("Судья")).not.toBeInTheDocument();
  });
  it("lets a user choose a character and persists it in their public profile", async () => {
    const session = await login();
    mount(ownPage(), "/profile?edit=1", session);
    const choice = await screen.findByRole("button", {
      name: "Женский аватар 4",
    });
    await userEvent.click(choice);
    expect(choice).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить профиль" }),
    );
    await screen.findByText("Профиль сохранён");
    const profile = await request<UserProfileDto>(`/users/${session.user.id}`);
    expect(profile.avatarUrl).toBe("/avatars/user/female-04.svg");
    await waitFor(() =>
      expect(document.querySelector(".profile-avatar img")).toHaveAttribute(
        "src",
        profile.avatarUrl,
      ),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Редактировать профиль" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Сбросить аватар" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить профиль" }),
    );
    await screen.findByText("Профиль сохранён");
    await waitFor(() =>
      expect(document.querySelector(".profile-avatar img")).toHaveAttribute(
        "src",
        session.user.avatarUrl,
      ),
    );
  });
  it("persists a validated own patch, public data and dynamic comment/participant names without granting rights", async () => {
    const session = await login();
    const comment = await request<CommentDto>(
      `/events/${mockId("basketball-yard")}/comments`,
      { method: "POST", body: JSON.stringify({ text: "Привет из профиля" }) },
    );
    const result = await request<UserProfileDto>("/me/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: "Александр Новый",
        nickname: "alex-new",
        bio: "Люблю бег",
        sportsRoles: ["SPORTS_ORGANIZER"],
        sportsPreferences: [{ sportId: mockId("running"), level: "AMATEUR" }],
        preferredTime: "EVENING",
      }),
    });
    expect(result).toMatchObject({
      displayName: "Александр Новый",
      rank: session.user.rank,
      ratingPoints: session.user.ratingPoints,
    });
    expect((await request<Session>("/session")).systemRoles).toEqual(["USER"]);
    expect(
      (
        await request<{ items: CommentDto[] }>(
          `/events/${mockId("basketball-yard")}/comments`,
        )
      ).items.find((item) => item.id === comment.id)?.author.displayName,
    ).toBe("Александр Новый");
    resetMockSession();
    setCsrfToken();
    const publicData = await request<UserProfileDto>(
      `/users/${session.user.id}`,
    );
    expect(publicData.nickname).toBe("alex-new");
    for (const key of ["systemRoles", "csrfToken", "demoAccountId"])
      expect(publicData).not.toHaveProperty(key);
    await expect(request("/me/profile")).rejects.toMatchObject({ status: 401 });
  });
  it("requires CSRF and rejects protected fields, duplicates and unknown sports atomically", async () => {
    await expect(
      request("/me/profile", { method: "PATCH", body: "{}" }),
    ).rejects.toMatchObject({ status: 401 });
    const session = await login();
    setCsrfToken();
    await expect(
      request("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ bio: "x" }),
      }),
    ).rejects.toMatchObject({ status: 403 });
    setCsrfToken(session.csrfToken);
    for (const body of [
      {},
      { ratingPoints: 10000 },
      { systemRoles: ["ADMIN"] },
      { nickname: "USER-MARIA" },
      { avatarUrl: "javascript:alert(1)" },
      { sportsRoles: ["COACH", "COACH"] },
    ]) {
      await expect(
        request("/me/profile", { method: "PATCH", body: JSON.stringify(body) }),
      ).rejects.toMatchObject({ status: "nickname" in body ? 409 : 400 });
    }
    await expect(
      request("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "Не сохранять",
          sportsPreferences: [
            { sportId: mockId("missing"), level: "BEGINNER" },
          ],
        }),
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect((await request<UserProfileDto>("/me/profile")).displayName).toBe(
      session.user.displayName,
    );
    await expect(request(`/users/${mockId("missing")}`)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("validates locally, retains fields after conflict and saves after retry", async () => {
    const session = await login();
    mount(ownPage(), "/profile?edit=1", session);
    const user = userEvent.setup();
    const handle = await screen.findByRole("textbox", {
      name: "Никнейм",
    });
    await user.clear(handle);
    await user.type(handle, "aa");
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }));
    expect(
      await screen.findByText("Никнейм: 3–40 латинских букв, цифр, _ или -"),
    ).toBeVisible();
    await user.clear(handle);
    await user.type(handle, "USER-MARIA");
    await user.type(
      screen.getByRole("textbox", { name: "О себе" }),
      "Мой сохранённый текст",
    );
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Никнейм уже занят",
    );
    expect(screen.getByRole("textbox", { name: "О себе" })).toHaveValue(
      "Мой сохранённый текст",
    );
    await user.clear(handle);
    await user.type(handle, "alex-new");
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }));
    expect(
      await screen.findByText("Профиль сохранён", { exact: true }),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Александр" }),
    ).toBeVisible();
    expect(screen.getByText("@alex-new", { exact: true })).toBeVisible();
  });
  it("disables repeated saves while pending and retains draft after a server failure", async () => {
    const session = await login();
    let posts = 0;
    server.use(
      http.patch("/api/v1/me/profile", async () => {
        posts++;
        await delay(150);
        return HttpResponse.json(
          { code: "SERVICE_UNAVAILABLE" },
          { status: 503 },
        );
      }),
    );
    mount(
      <ProfileForm
        profile={readProfile(session.user)}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
      "/profile?edit=1",
      session,
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "О себе" }),
      "Черновик",
    );
    await user.click(screen.getByRole("button", { name: "Сохранить профиль" }));
    expect(
      await screen.findByRole("button", { name: "Сохраняем профиль…" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    expect(posts).toBe(1);
    expect(screen.getByRole("textbox", { name: "О себе" })).toHaveValue(
      "Черновик",
    );
  });
  it("does not read a private profile before delayed Session resolves or store it under a guest key", async () => {
    await login();
    let calls = 0;
    server.use(
      http.get("/api/v1/session", async () => {
        await delay(100);
        return HttpResponse.json(makeSession("user-alex"));
      }),
      http.get("/api/v1/me/profile", () => {
        calls++;
        return HttpResponse.json(makeSession("user-alex")!.user);
      }),
    );
    const client = mount(ownPage());
    expect(calls).toBe(0);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Александр",
    );
    expect(calls).toBe(1);
    expect(client.getQueryData(profileKeys.own(""))).toBeUndefined();
  });
  it("keeps the editor on background 503 but hides private data after access is lost", async () => {
    const session = await login();
    const client = mount(ownPage(), "/profile?edit=1", session);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole("textbox", { name: "О себе" }),
      "Не терять",
    );
    server.use(
      http.get(
        "/api/v1/me/profile",
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    await act(() =>
      client.invalidateQueries({ queryKey: profileKeys.own(session.user.id) }),
    );
    expect(screen.getByRole("textbox", { name: "О себе" })).toHaveValue(
      "Не терять",
    );
    server.use(
      http.get(
        "/api/v1/me/profile",
        () => new HttpResponse(null, { status: 403 }),
      ),
    );
    await act(() =>
      client.invalidateQueries({ queryKey: profileKeys.own(session.user.id) }),
    );
    expect(
      screen.queryByRole("textbox", { name: "О себе" }),
    ).not.toBeInTheDocument();
  });
  it("ignores a late save after switching accounts", async () => {
    const session = await login();
    let resolve: (() => void) | undefined;
    const response = new Promise<void>((done) => {
      resolve = done;
    });
    server.use(
      http.patch("/api/v1/me/profile", async () => {
        await response;
        return HttpResponse.json(session.user);
      }),
    );
    const saved = vi.fn();
    const client = mount(
      <ProfileForm
        profile={readProfile(session.user)}
        onSaved={saved}
        onCancel={vi.fn()}
      />,
      "/profile?edit=1",
      session,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Сохранить профиль" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Сохраняем профиль…" }),
      ).toBeDisabled(),
    );
    const next = await login("user-maria");
    act(() => {
      client.clear();
      client.setQueryData(sessionQuery.queryKey, next);
    });
    await act(async () => {
      resolve!();
      await response;
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Сохранить профиль" }),
      ).toBeEnabled(),
    );
    expect(saved).not.toHaveBeenCalled();
    expect(
      client.getQueryData(profileKeys.own(session.user.id)),
    ).toBeUndefined();
  });
  it("falls back from a failed avatar and renders a biography as text", () => {
    const profile = readProfile({
      ...makeSession("user-alex")!.user,
      avatarUrl: "https://example.com/avatar.png",
      bio: "<script>alert(1)</script>",
    });
    render(<ProfileSummary profile={profile} sports={[]} />);
    fireEvent.error(document.querySelector(".profile-avatar img")!);
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
    expect(
      screen.getByText("<script>alert(1)</script>", { exact: true }),
    ).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
  });
});
