import { expect, type Page } from "@playwright/test";
import type {
  Session,
  Sport,
  EventCreate,
  EventPreview,
} from "../../src/shared/api/types";

// S1 covers creation through the form; S6 prepares its event via the same public API.
export async function setupModerationEvent(page: Page, title: string) {
  return page.evaluate(async (name) => {
    const session: Session = await (
      await fetch("/api/v1/session", { credentials: "include" })
    ).json();
    const sports: Sport[] = await (
      await fetch("/api/v1/sports", { credentials: "include" })
    ).json();
    const sport = sports.find((item) => item.name === "Бег") ?? sports[0];
    const body: EventCreate = {
      title: name,
      description:
        "Встречаемся в парке и бежим в спокойном темпе. Приходите знакомиться.",
      sport: { sportId: sport.id },
      startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      location: { city: "Москва", address: "Парк, главный вход" },
      skillLevel: "ANY",
      eventKind: "ACTIVITY",
      joinMode: "OPEN",
      maxParticipants: 10,
      organizer: { type: "USER", id: session.user.id },
      publishNow: true,
    };
    const response = await fetch("/api/v1/events", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      },
      body: JSON.stringify(body),
    });
    if (response.status !== 201)
      throw new Error(`Cannot prepare S6 event: HTTP ${response.status}`);
    const event: EventPreview = await response.json();
    return event;
  }, title);
}
export async function sendDiscussion(page: Page, text: string) {
  await page
    .getByRole("textbox", { name: "Ваше сообщение", exact: true })
    .fill(text);
  await page
    .getByRole("button", { name: "Отправить сообщение", exact: true })
    .click();
  await expect(
    page.locator(".comment-text").getByText(text, { exact: true }),
  ).toBeVisible();
}
export async function findModerationEvent(page: Page, title: string) {
  await page.goto("/admin?section=events");
  await page
    .getByLabel("Название или описание мероприятия", { exact: true })
    .fill(title);
  await page
    .getByRole("button", { name: "Найти мероприятия", exact: true })
    .click();
  return page.getByRole("article", {
    name: `Мероприятие: ${title}`,
    exact: true,
  });
}
