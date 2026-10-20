import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

for (const width of [375, 1024, 1440]) {
  test(`participation confirmation, history and rejoining at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, "user-alex");
    const event = await page.evaluate(async () => {
      const session = await (await fetch("/api/v1/session")).json();
      const events = await (await fetch("/api/v1/events?size=24")).json();
      const event = events.items.find(
        (item: {
          startsAt: string;
          joinMode: string;
          maxParticipants?: number;
          confirmedCount: number;
        }) =>
          Date.parse(item.startsAt) > Date.now() &&
          item.joinMode === "OPEN" &&
          (!item.maxParticipants || item.confirmedCount < item.maxParticipants),
      );
      const response = await fetch(`/api/v1/events/${event.id}/registrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        },
        body: "{}",
      });
      if (!response.ok) throw new Error(`Join failed: ${response.status}`);
      return { id: event.id, title: event.title };
    });
    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Мои мероприятия" })
      .click();
    const card = page.locator(".my-event").filter({ hasText: event.title });
    await expect(card).toBeVisible();
    await card
      .getByRole("button", { name: "Отменить участие", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Отменить участие?",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Оставить участие" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      card.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await card
      .getByRole("button", { name: "Отменить участие", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Да, отменить участие" }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole("link", { name: "История", exact: true }).click();
    await expect(
      card.getByText("Участие отменено", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(card).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/my-events-${width}.png`,
      fullPage: true,
    });
    await card.getByRole("link", { name: "Подробнее", exact: true }).click();
    await page
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Отменить участие", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Да, отменить участие" }).click();
    await expect(
      page.getByRole("button", { name: "Присоединиться", exact: true }),
    ).toBeVisible();
  });
}
