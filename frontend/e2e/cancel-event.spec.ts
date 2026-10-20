import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

for (const { account, width } of [
  { account: "user-alex", width: 375 },
  { account: "org-run", width: 1440 },
]) {
  test(`creator can cancel ${account} event with confirmation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, account);
    const event = await page.evaluate(async (account) => {
      const session = await (await fetch("/api/v1/session")).json();
      const sports = await (await fetch("/api/v1/sports")).json();
      const organizations =
        account === "org-run"
          ? await (await fetch("/api/v1/me/organizations")).json()
          : [];
      const organizer =
        account === "org-run"
          ? {
              type: "ORGANIZATION",
              id: organizations.find(
                (item: { status: string }) => item.status === "APPROVED",
              ).id,
            }
          : { type: "USER", id: session.user.id };
      const response = await fetch("/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        },
        body: JSON.stringify({
          title: `Отмена ${account}`,
          description: "Встреча для проверки отмены организатором",
          sport: { sportId: sports[0].id },
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          location: { city: "Самара", address: "Парк, главный вход" },
          joinMode: "OPEN",
          skillLevel: "ANY",
          eventKind: "ACTIVITY",
          maxParticipants: 5,
          organizer,
        }),
      });
      if (!response.ok)
        throw new Error(
          `Create failed: ${response.status} ${await response.text()}`,
        );
      return response.json();
    }, account);
    await page.goto(`/events/${event.id}`);
    await page
      .getByRole("button", { name: "Отменить мероприятие", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Отменить мероприятие?",
      exact: true,
    });
    await dialog.getByRole("button", { name: "Оставить мероприятие" }).click();
    await expect(dialog).toHaveCount(0);
    await signInAs(page, "user-maria");
    await page.goto(`/events/${event.id}`);
    await expect(
      page.getByRole("button", { name: "Отменить мероприятие", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    const denied = await page.evaluate(async (id) => {
      const session = await (await fetch("/api/v1/session")).json();
      return (
        await fetch(`/api/v1/events/${id}/cancel`, {
          method: "POST",
          headers: { "X-CSRF-Token": session.csrfToken },
        })
      ).status;
    }, event.id);
    expect(denied).toBe(403);
    await signInAs(page, account);
    await page.goto("/my-events?view=created");
    const card = page.locator(".my-event").filter({ hasText: event.title });
    await card
      .getByRole("button", { name: "Отменить мероприятие", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Оставить мероприятие" }),
    ).toBeFocused();
    await dialog.screenshot({
      path: `test-results/cancel-event-${account}.png`,
    });
    await dialog
      .getByRole("button", { name: "Да, отменить мероприятие" })
      .click();
    await expect(
      card.getByText("Мероприятие отменено организатором", { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Отменить мероприятие", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(card).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await signInAs(page, "user-maria");
    await page.goto("/my-events?view=history");
    await expect(
      card.getByText("Мероприятие отменено организатором", { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByText("Участие отменено", { exact: true }),
    ).toBeVisible();
    await card.getByRole("link", { name: "Подробнее", exact: true }).click();
    await expect(
      page.getByText(/Запись закрыта ·.*Мероприятие отменено организатором/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Присоединиться", exact: true }),
    ).toHaveCount(0);
    const notices = await page.evaluate(
      async () =>
        (await (await fetch("/api/v1/me/notifications?size=100")).json()).items,
    );
    expect(
      notices.some(
        (notice: { title: string; href: string }) =>
          notice.title === "Мероприятие отменено организатором" &&
          notice.href === `/events/${event.id}`,
      ),
    ).toBe(true);
  });
}
