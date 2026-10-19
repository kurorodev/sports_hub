import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "./setup";
import { OrganizationServices } from "../app/providers";
import { sessionQuery, switchAccount } from "../entities/session";
import { request, setCsrfToken } from "../shared/api/client";
import type { OrganizationDto, Page, Session } from "../shared/api/types";
import { mockId, makeSession } from "../mocks/database";
import { resetMockSession } from "../mocks/handlers";
import { getOrganizations } from "../mocks/organizations";
import { MyOrganizations } from "../features/organization-application";
import { CreateEventPage } from "../pages/create-event";
import { OrganizationPage } from "../pages/organizations";
import { AdminOrganizations } from "../features/review-organizations";
import { OrganizationDecisionCard } from "../features/review-organizations/ui/OrganizationDecisionCard";
import { OrganizationRepositoryProvider } from "../entities/organization";
import type {
  Organization,
  OrganizationRepository,
} from "../entities/organization/model";

const input = {
  name: "Новый клуб",
  description: "Помогаем начинающим заниматься спортом вместе.",
  sports: [mockId("running")],
};
async function login(id = "user-alex") {
  const session = await switchAccount(id);
  setCsrfToken(session.csrfToken);
  return session;
}
const apply = (body: unknown = input) =>
  request<OrganizationDto>("/organizations", {
    method: "POST",
    body: JSON.stringify(body),
  });
const decide = (id: string, decision = "APPROVE", reason?: string) =>
  request<OrganizationDto>(`/admin/organizations/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, reason }),
  });
const eventBody = (organizationId: string) => ({
  title: "Встреча клуба",
  description: "Собираемся в парке для спокойной пробежки.",
  sport: { sportId: mockId("running") },
  startsAt: "2026-12-01T12:00:00Z",
  location: { city: "Москва", address: "Парк" },
  joinMode: "OPEN",
  skillLevel: "ANY",
  eventKind: "ACTIVITY",
  maxParticipants: 10,
  organizer: { type: "ORGANIZATION", id: organizationId },
  publishNow: true,
});
const publish = (id: string) =>
  request("/events", { method: "POST", body: JSON.stringify(eventBody(id)) });
function mount(ui: React.ReactNode, path = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <OrganizationServices>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </OrganizationServices>,
  );
  return client;
}
describe("S2 network state and permissions", () => {
  it("persists approval and rejection, reason, public visibility and publishing rights", async () => {
    const owner = await login();
    const pending = await apply();
    const rejected = await apply({ ...input, name: "Другой клуб" });
    await expect(publish(pending.id)).rejects.toMatchObject({
      status: 403,
      body: { code: "ORGANIZATION_NOT_APPROVED" },
    });
    expect(
      (await request<Session>("/session")).manageableOrganizationIds,
    ).not.toContain(pending.id);
    await login("user-maria");
    await expect(request(`/organizations/${pending.id}`)).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(decide(pending.id)).rejects.toMatchObject({ status: 403 });
    await expect(publish(pending.id)).rejects.toMatchObject({ status: 403 });
    await login("admin");
    expect(
      (
        await request<Page<OrganizationDto>>(
          "/admin/organizations?status=PENDING",
        )
      ).total,
    ).toBe(2);
    await decide(pending.id);
    await decide(rejected.id, "REJECT", "Уточните спортивное направление");
    await expect(decide(pending.id)).rejects.toMatchObject({ status: 409 });
    await login();
    const session = await request<Session>("/session");
    expect(session.systemRoles).toContain("ORGANIZATION");
    expect(session.manageableOrganizationIds).toContain(pending.id);
    expect(
      (await request<OrganizationDto[]>("/me/organizations")).find(
        (item) => item.id === rejected.id,
      )?.decisionReason,
    ).toBe("Уточните спортивное направление");
    await expect(publish(rejected.id)).rejects.toMatchObject({ status: 403 });
    await publish(pending.id);
    await publish(pending.id);
    resetMockSession();
    setCsrfToken();
    const catalog = await request<Page<OrganizationDto>>(
      "/organizations?q=клуб",
    );
    expect(catalog.items.some((item) => item.id === pending.id)).toBe(true);
    expect(catalog.items.some((item) => item.id === rejected.id)).toBe(false);
    expect(
      (await request<Page<unknown>>(`/organizations/${pending.id}/events`))
        .total,
    ).toBe(2);
    await expect(
      request(`/organizations/${rejected.id}`),
    ).rejects.toMatchObject({ status: 404 });
    expect(owner.user.id).toBe(pending.createdBy.id);
  });
  it("checks authentication, CSRF, validation and mandatory refusal reason", async () => {
    await expect(apply()).rejects.toMatchObject({ status: 401 });
    await login();
    setCsrfToken("old");
    await expect(apply()).rejects.toMatchObject({ status: 403 });
    await login();
    for (const body of [
      { ...input, name: "a" },
      { ...input, name: "a".repeat(161) },
      { ...input, description: "a".repeat(2001) },
      { ...input, createdBy: { id: mockId("admin") } },
    ])
      await expect(apply(body)).rejects.toMatchObject({ status: 400 });
    const org = await apply();
    await login("admin");
    await expect(decide(org.id, "REJECT")).rejects.toMatchObject({
      status: 400,
    });
    await expect(decide(org.id, "REJECT", " ")).rejects.toMatchObject({
      status: 400,
    });
    expect(getOrganizations().find((item) => item.id === org.id)?.status).toBe(
      "PENDING",
    );
    setCsrfToken("old");
    await expect(decide(org.id)).rejects.toMatchObject({ status: 403 });
  });
  it("supports admin search, status and pagination; personal organization lookup is private", async () => {
    await login();
    for (let i = 0; i < 7; i++)
      await apply({ ...input, name: `Клуб номер ${i}` });
    await expect(request("/admin/organizations")).rejects.toMatchObject({
      status: 403,
    });
    await login("user-maria");
    expect(await request("/me/organizations")).toEqual([]);
    await login("admin");
    const second = await request<Page<OrganizationDto>>(
      "/admin/organizations?q=Клуб номер&status=PENDING&page=1&size=6",
    );
    expect(second.total).toBe(7);
    expect(second.items).toHaveLength(1);
  });
});
describe("organization UI", () => {
  it("waits for restored identity before reading a private profile into a viewer cache", async () => {
    await login();
    const org = await apply();
    const admin = await login("admin");
    let release = () => {};
    const response = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    server.use(
      http.get("/api/v1/session", async () => {
        await response;
        return HttpResponse.json(admin);
      }),
      http.get(`/api/v1/organizations/${org.id}`, () => {
        reads++;
        return HttpResponse.json(org);
      }),
    );
    const client = mount(
      <Routes>
        <Route
          path="/organizations/:organizationId"
          element={<OrganizationPage />}
        />
      </Routes>,
      `/organizations/${org.id}`,
    );
    try {
      expect(
        await screen.findByText("Проверяем сессию для страницы организации…"),
      ).toBeVisible();
      expect(reads).toBe(0);
      await act(async () => {
        release();
        await response;
      });
      expect(
        await screen.findByRole("heading", { name: org.name }),
      ).toBeVisible();
      expect(reads).toBe(1);
      expect(
        client.getQueryData(["organizations", "detail", org.id, "guest"]),
      ).toBeUndefined();
      expect(
        client.getQueryData(["organizations", "detail", org.id, admin.user.id]),
      ).toMatchObject({ id: org.id, status: "PENDING" });
    } finally {
      release();
    }
  });
  it("preserves an event draft if revalidating approved organizations fails", async () => {
    await login("org-run");
    const client = mount(<CreateEventPage />);
    const title = await screen.findByLabelText("Название встречи");
    await userEvent.type(title, "Моя встреча клуба");
    server.use(
      http.get("/api/v1/me/organizations", () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    await act(async () => {
      await client.refetchQueries({ queryKey: ["organizations", "mine"] });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Данные формы сохранены",
    );
    expect(screen.getByLabelText("Название встречи")).toHaveValue(
      "Моя встреча клуба",
    );
    server.resetHandlers();
    await userEvent.click(
      screen.getByRole("button", {
        name: "Обновить организации для публикации",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Название встречи")).toHaveValue(
      "Моя встреча клуба",
    );
  });
  it("allows an ordinary user to apply, prevents duplicates while pending and clears only after 201", async () => {
    const session = await login();
    server.use(
      http.post("/api/v1/organizations", async () => {
        await delay(150);
        return HttpResponse.json({}, { status: 503 });
      }),
    );
    mount(<MyOrganizations viewerId={session.user.id} sports={[]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Название организации"), input.name);
    await user.type(
      screen.getByLabelText("О вашей организации"),
      input.description,
    );
    await user.dblClick(
      screen.getByRole("button", { name: "Отправить заявку организации" }),
    );
    expect(
      screen.getByRole("button", { name: "Отправляем заявку…" }),
    ).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Данные формы сохранены",
    );
    expect(screen.getByLabelText("Название организации")).toHaveValue(
      input.name,
    );
    server.resetHandlers();
    await user.click(
      screen.getByRole("button", { name: "Отправить заявку организации" }),
    );
    expect(
      await screen.findByText(/заявка отправлена на рассмотрение/),
    ).toBeVisible();
    expect(screen.getByLabelText("Название организации")).toHaveValue("");
    expect(await screen.findByText("Заявка на рассмотрении")).toBeVisible();
  });
  it("requires refusal reason, restores focus after cancel and preserves reason after failure", async () => {
    await login();
    const org = await apply();
    await login("admin");
    server.use(
      http.post(`/api/v1/admin/organizations/${org.id}/decision`, () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    const client = mount(<AdminOrganizations viewerId={mockId("admin")} />);
    client.setQueryData(sessionQuery.queryKey, makeSession("admin"));
    const row = await screen.findByRole("article", {
      name: `Организация: ${input.name}`,
    });
    const user = userEvent.setup();
    await user.click(
      within(row).getByRole("button", { name: "Отклонить организацию" }),
    );
    const field = screen.getByLabelText("Причина отказа");
    expect(field).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Подтвердить отказ организации" }),
    );
    expect(
      await screen.findByText("Укажите причину: от 3 символов"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(
      within(row).getByRole("button", { name: "Отклонить организацию" }),
    ).toHaveFocus();
    await user.click(
      within(row).getByRole("button", { name: "Отклонить организацию" }),
    );
    await user.type(
      screen.getByLabelText("Причина отказа"),
      "Уточните описание",
    );
    await user.click(
      screen.getByRole("button", { name: "Подтвердить отказ организации" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Причина сохранена",
    );
    expect(screen.getByLabelText("Причина отказа")).toHaveValue(
      "Уточните описание",
    );
    server.resetHandlers();
    await user.click(
      screen.getByRole("button", { name: "Подтвердить отказ организации" }),
    );
    expect(await screen.findByText(/решение сохранено/)).toBeVisible();
    expect(
      screen.queryByRole("article", { name: `Организация: ${input.name}` }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Статус организаций"),
      "REJECTED",
    );
    expect(
      await screen.findByRole("article", {
        name: `Организация: ${input.name}`,
      }),
    ).toHaveTextContent("Уточните описание");
  });
  it("refreshes the server session after the server grants approval", async () => {
    const session = await login();
    const org = await apply();
    const client = mount(
      <MyOrganizations viewerId={session.user.id} sports={[]} />,
    );
    await screen.findByText("Заявка на рассмотрении");
    await login("admin");
    await decide(org.id);
    await login();
    await userEvent.click(
      screen.getByRole("button", { name: "Обновить мои организации" }),
    );
    expect(
      await screen.findByRole("link", {
        name: "Создать встречу от организации",
      }),
    ).toHaveAttribute("href", `/events/new?organizationId=${org.id}`);
    await waitFor(() =>
      expect(
        client.getQueryData(sessionQuery.queryKey)?.manageableOrganizationIds,
      ).toContain(org.id),
    );
  });
  it("does not announce a late decision in another account", async () => {
    const owner = makeSession("user-alex")!,
      admin = makeSession("admin")!;
    const org: Organization = {
      id: mockId("late-org"),
      name: input.name,
      description: input.description,
      sports: [],
      status: "PENDING",
      representative: { id: owner.user.id, displayName: "Александр" },
      submittedAt: new Date().toISOString(),
    };
    let finish: ((value: Organization) => void) | undefined;
    const response = new Promise<Organization>((resolve) => {
      finish = resolve;
    });
    const repo: OrganizationRepository = {
      list: vi.fn(),
      mine: vi.fn(),
      find: vi.fn(),
      apply: vi.fn(),
      decide: vi.fn(() => response),
    };
    const onDecided = vi.fn();
    const client = new QueryClient();
    client.setQueryData(sessionQuery.queryKey, admin);
    render(
      <OrganizationRepositoryProvider repository={repo}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <OrganizationDecisionCard
              organization={org}
              viewerId={admin.user.id}
              onDecided={onDecided}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </OrganizationRepositoryProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Одобрить организацию" }),
    );
    await act(async () => {
      client.setQueryData(sessionQuery.queryKey, owner);
      finish!({ ...org, status: "APPROVED" });
      await response;
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Одобрить организацию" }),
      ).toBeEnabled(),
    );
    expect(onDecided).not.toHaveBeenCalled();
  });
});
