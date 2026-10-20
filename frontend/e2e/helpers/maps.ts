import type { Page } from "@playwright/test";
import type {
  Session,
  Sport,
  EventCreate,
  EventPreview,
} from "../../src/shared/api/types";

// Создаём события через API, чтобы здесь проверять карту и модерацию, а не форму создания.
export function setupMapEvent(page: Page, title: string, startsAt: string) {
  return page.evaluate(
    async (input) => {
      const session: Session = await (
        await fetch("/api/v1/session", { credentials: "include" })
      ).json();
      const sports: Sport[] = await (
        await fetch("/api/v1/sports", { credentials: "include" })
      ).json();
      const body: EventCreate = {
        title: input.title,
        description: "Встречаемся на площади, знакомимся и начинаем пробежку.",
        sport: { sportId: sports.find((item) => item.name === "Легкая атлетика")!.id },
        startsAt: input.startsAt,
        location: {
          city: "Самара",
          address: "площадь Куйбышева",
          latitude: 53.195561,
          longitude: 50.101022,
        },
        joinMode: "OPEN",
        skillLevel: "ANY",
        eventKind: "ACTIVITY",
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
        throw new Error(`Prepare map event: ${response.status}`);
      return (await response.json()) as EventPreview;
    },
    { title, startsAt },
  );
}
