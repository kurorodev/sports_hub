import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { OrganizerPreview } from "../entities/event";
import { mockId } from "../mocks/database";
import { server } from "./setup";

afterEach(() => vi.restoreAllMocks());
const organizer = {
  type: "USER" as const,
  id: mockId("user-alex"),
  name: "Александр",
};
const profile = {
  id: organizer.id,
  displayName: organizer.name,
  nickname: "alex",
  bio: "Бегаю по утрам",
  city: "Москва",
};
function mount(
  value = organizer as {
    type: "USER" | "ORGANIZATION";
    id: string;
    name: string;
  },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OrganizerPreview organizer={value} />
        <button>Снаружи</button>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe("organizer preview", () => {
  it("loads only on hover, shows brief info and copies the handle without navigating", async () => {
    let calls = 0;
    server.use(
      http.get(`/api/v1/users/${organizer.id}`, () => {
        calls++;
        return HttpResponse.json(profile);
      }),
    );
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    mount();
    expect(calls).toBe(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.hover(screen.getByRole("link", { name: organizer.name }));
    const card = await screen.findByRole("dialog", {
      name: `Организатор: ${organizer.name}`,
    });
    expect(await within(card).findByText(profile.bio)).toBeVisible();
    expect(within(card).getByText(profile.city)).toBeVisible();
    await user.hover(card);
    await user.click(
      within(card).getByRole("button", { name: "Скопировать @alex" }),
    );
    expect(write).toHaveBeenCalledExactlyOnceWith("@alex");
    expect(await within(card).findByText("Никнейм скопирован")).toBeVisible();
    expect(
      within(card).getByRole("link", { name: "Открыть профиль" }),
    ).toHaveAttribute("href", `/users/${organizer.id}`);
    expect(calls).toBe(1);
    // A click leaves focus on Copy; that focus must not pin a mouse preview.
    await user.hover(screen.getByRole("button", { name: "Снаружи" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("opens with keyboard, closes with Escape, restores focus and dismisses outside", async () => {
    const user = userEvent.setup();
    mount();
    await user.tab();
    expect(screen.getByRole("link", { name: organizer.name })).toHaveFocus();
    expect(await screen.findByRole("dialog")).toBeVisible();
    await user.tab();
    const info = screen.getByRole("button", {
      name: `Краткая информация: ${organizer.name}`,
    });
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(info).toHaveFocus();
    await user.click(info);
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Снаружи" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes after leaving both trigger and popup, allowing pointer travel across the gap", async () => {
    mount();
    const link = screen.getByRole("link", { name: organizer.name });
    fireEvent.pointerEnter(link, { pointerType: "mouse" });
    const card = await screen.findByRole("dialog");
    fireEvent.pointerLeave(link, { pointerType: "mouse" });
    fireEvent.pointerEnter(card, { pointerType: "mouse" });
    await new Promise((resolve) => setTimeout(resolve, 220));
    expect(card).toBeInTheDocument();
    fireEvent.pointerLeave(card, { pointerType: "mouse" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows organization description and copies its representative's real nickname", async () => {
    const user = userEvent.setup();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    mount({ type: "ORGANIZATION", id: mockId("org-temp"), name: "Темп" });
    await user.click(
      screen.getByRole("button", { name: "Краткая информация: Темп" }),
    );
    const card = screen.getByRole("dialog");
    expect(await within(card).findByText(/Открытый клуб/)).toBeVisible();
    expect(within(card).getByText(/Представитель:/)).toBeVisible();
    await user.click(
      within(card).getByRole("button", { name: "Скопировать @org-run" }),
    );
    expect(write).toHaveBeenCalledExactlyOnceWith("@org-run");
    expect(
      within(card).getByRole("link", { name: "Открыть страницу организации" }),
    ).toHaveAttribute("href", `/organizations/${mockId("org-temp")}`);
  });

  it("offers retry on API failure and fetches an updated nickname after reopening", async () => {
    server.use(
      http.get(
        `/api/v1/users/${organizer.id}`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    mount();
    const info = screen.getByRole("button", {
      name: `Краткая информация: ${organizer.name}`,
    });
    await user.click(info);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось загрузить",
    );
    expect(
      screen.queryByRole("button", { name: /Скопировать/ }),
    ).not.toBeInTheDocument();
    server.use(
      http.get(`/api/v1/users/${organizer.id}`, () =>
        HttpResponse.json(profile),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("button", { name: "Скопировать @alex" }),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    server.use(
      http.get(`/api/v1/users/${organizer.id}`, () =>
        HttpResponse.json({ ...profile, nickname: "alex-new" }),
      ),
    );
    await user.click(info);
    expect(
      await screen.findByRole("button", { name: "Скопировать @alex-new" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Скопировать @alex" }),
    ).not.toBeInTheDocument();
  });

  it.each([{}, { ...profile, id: mockId("user-maria") }])(
    "does not offer copying malformed or mismatched identity %#",
    async (response) => {
      server.use(
        http.get(`/api/v1/users/${organizer.id}`, () =>
          HttpResponse.json(response),
        ),
      );
      mount();
      await userEvent.setup().click(
        screen.getByRole("button", {
          name: `Краткая информация: ${organizer.name}`,
        }),
      );
      expect(await screen.findByRole("alert")).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /Скопировать/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("offers manual selection when copying is denied, without reporting success", async () => {
    server.use(
      http.get(`/api/v1/users/${organizer.id}`, () =>
        HttpResponse.json(profile),
      ),
    );
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    mount();
    await user.click(
      screen.getByRole("button", {
        name: `Краткая информация: ${organizer.name}`,
      }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Скопировать @alex" }),
    );
    expect(
      await screen.findByRole("textbox", {
        name: "Никнейм для ручного копирования",
      }),
    ).toHaveValue("@alex");
    expect(screen.queryByText("Никнейм скопирован")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
