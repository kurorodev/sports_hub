import { notificationScenarios } from "../helpers/notifications";
import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import { setupModerationEvent } from "../helpers/moderation";
import type { Session } from "../../src/shared/api/types";
import type { components } from "../../src/shared/api/generated/schema";
notificationScenarios("athlete-a", "athlete-b", "Java notifications");

test("Java notifications: the server scheduler delivers an upcoming reminder", async ({
  page,
}) => {
  test.setTimeout(100000);
  await signInAs(page, "athlete-a");
  const event = await setupModerationEvent(
    page,
    `Напоминание Java ${Date.now()}`,
  );
  const session: Session = await (
    await page.request.get("/api/v1/session")
  ).json();
  const changed = await page.request.patch(`/api/v1/events/${event.id}`, {
    data: { startsAt: new Date(Date.now() + 1800_000).toISOString() },
    headers: { "X-CSRF-Token": session.csrfToken },
  });
  expect(changed.status()).toBe(200);
  await signInAs(page, "athlete-b");
  await page.goto(`/events/${event.id}`);
  await page
    .getByRole("button", { name: "Присоединиться", exact: true })
    .click();
  await expect(page.getByText("Вы участвуете", { exact: true })).toBeVisible();
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          "/api/v1/me/notifications?size=100",
        );
        expect(response.status()).toBe(200);
        const notifications: components["schemas"]["NotificationPage"] =
          await response.json();
        return notifications.items.filter(
          (n) =>
            n.type === "EVENT_STARTING" && n.href === `/events/${event.id}`,
        ).length;
      },
      { timeout: 75000, intervals: [1000, 3000, 5000] },
    )
    .toBe(1);
  await page.getByRole("button", { name: /^Уведомления/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Уведомления" })
      .locator(".notification-item")
      .filter({ hasText: event.title })
      .filter({ hasText: "Встреча скоро начнётся" }),
  ).toBeVisible();
});
