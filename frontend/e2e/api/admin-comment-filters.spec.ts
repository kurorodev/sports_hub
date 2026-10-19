import { expect, test } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import { setupModerationEvent } from "../helpers/moderation";
import type { Session } from "../../src/shared/api/types";

for (const width of [375, 1440]) {
  test(`Java admin comment filters combine and survive reload at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "athlete-a");
    const event = await setupModerationEvent(
      page,
      `Фильтры комментариев ${width} ${Date.now()}`,
    );
    const author: Session = await (
      await page.request.get("/api/v1/session")
    ).json();
    for (let i = 0; i < 12; i++) {
      const response = await page.request.post(
        `/api/v1/events/${event.id}/comments`,
        {
          data: { text: `Сообщение автора ${i}` },
          headers: { "X-CSRF-Token": author.csrfToken },
        },
      );
      expect(response.status()).toBe(201);
    }
    await signInAs(page, "athlete-b");
    const other: Session = await (
      await page.request.get("/api/v1/session")
    ).json();
    const posted = await page.request.post(
      `/api/v1/events/${event.id}/comments`,
      {
        data: { text: "Сообщение другого автора" },
        headers: { "X-CSRF-Token": other.csrfToken },
      },
    );
    expect(posted.status()).toBe(201);
    await signInAs(page, "admin");
    await page.goto("/admin?section=comments");
    await page.getByLabel("Поиск мероприятия по названию").fill(event.title);
    await expect(
      page.locator(`#comment-event option[value="${event.id}"]`),
    ).toHaveCount(1);
    await page
      .getByLabel("Мероприятие", { exact: true })
      .selectOption(event.id);
    await expect(page.getByText("Найдено комментариев: 13")).toBeVisible();
    await page
      .getByLabel("Поиск пользователя по никнейму")
      .fill(author.user.nickname);
    await expect(
      page.locator(`#comment-author option[value="${author.user.id}"]`),
    ).toHaveCount(1);
    await page
      .getByLabel("Пользователь", { exact: true })
      .selectOption(author.user.id);
    await expect(page.getByText("Найдено комментариев: 12")).toBeVisible();
    await page.getByLabel("Последние 10 комментариев").click();
    await expect(page.getByLabel("Последние 10 комментариев")).toBeChecked();
    await page.getByLabel("За последние 24 часа").click();
    await expect(page.getByLabel("За последние 24 часа")).toBeChecked();
    await expect(page.getByText("Найдено комментариев: 10")).toBeVisible();
    await expect(page.locator(".moderation-text")).toHaveCount(10);
    await expect(page.locator(".moderation-text").first()).toHaveText(
      "Сообщение автора 11",
    );
    await expect(
      page.getByText("Сообщение другого автора", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel("Пользователь", { exact: true })).toHaveValue(
      author.user.id,
    );
    await expect(page.getByLabel("Мероприятие", { exact: true })).toHaveValue(
      event.id,
    );
    await expect(page.getByLabel("Последние 10 комментариев")).toBeChecked();
    await expect(page.getByLabel("За последние 24 часа")).toBeChecked();
    await expect(page.locator(".moderation-text")).toHaveCount(10);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/admin-comment-filters-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Пользователь", { exact: true }).selectOption("");
    await expect(
      page.getByText("Сообщение другого автора", { exact: true }),
    ).toBeVisible();
    const response = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/v1/admin/comments" &&
        !url.searchParams.has("eventId") &&
        !url.searchParams.has("authorId") &&
        !url.searchParams.has("latest") &&
        !url.searchParams.has("last24Hours")
      );
    });
    await page.getByRole("button", { name: "Сбросить фильтры" }).click();
    const resetResponse = await response;
    expect(resetResponse.status()).toBe(200);
    expect(resetResponse.fromServiceWorker()).toBe(false);
  });
}
