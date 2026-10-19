import { expect, test } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import { setupModerationEvent } from "../helpers/moderation";
import type { Session } from "../../src/shared/api/types";

for (const width of [320, 375, 768, 1440]) {
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
    const eventSearch = page.getByRole("combobox", { name: "Мероприятие" });
    const userSearch = page.getByRole("combobox", { name: "Пользователь" });
    await eventSearch.fill("Ф");
    const eventOption = page.getByRole("option", {
      name: new RegExp(event.title),
    });
    await expect(eventOption).toBeVisible();
    await page.screenshot({
      path: `test-results/admin-comment-search-${width}.png`,
      fullPage: true,
    });
    await eventOption.click();
    await expect(page).not.toHaveURL(/eventId=/);
    await page.getByRole("button", { name: "Применить фильтры" }).click();
    await expect(page.getByText("Найдено комментариев: 13")).toBeVisible();
    await expect(
      page.getByText(
        "Ищите только по никнейму @user. По имени и фамилии поиск не работает.",
      ),
    ).toBeVisible();
    await userSearch.fill(`@${author.user.nickname[0]}`);
    const authorOption = page.getByRole("option", {
      name: `${author.user.displayName} @${author.user.nickname}`,
      exact: true,
    });
    await expect(authorOption).toBeVisible();
    await authorOption.click();
    await expect(page.getByText("Найдено комментариев: 13")).toBeVisible();
    await expect(page).not.toHaveURL(/authorId=/);
    // Both settings may be changed immediately, without losing the preceding URL update.
    await page.getByLabel("Последние 10 комментариев").click();
    await page.getByLabel("За последние 24 часа").click();
    await expect(page.getByLabel("Последние 10 комментариев")).toBeChecked();
    await expect(page.getByLabel("За последние 24 часа")).toBeChecked();
    await expect(page.getByText("Найдено комментариев: 13")).toBeVisible();
    await expect(page).not.toHaveURL(/latest=/);
    await page.getByRole("button", { name: "Применить фильтры" }).click();
    await expect(page.getByText("Найдено комментариев: 10")).toBeVisible();
    await expect(page.locator(".moderation-text")).toHaveCount(10);
    await expect(page.locator(".moderation-text").first()).toHaveText(
      "Сообщение автора 11",
    );
    await expect(
      page.getByText("Сообщение другого автора", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Сбросить: Пользователь" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Сбросить: Мероприятие" }),
    ).toBeVisible();
    await expect(
      page
        .locator(".comment-search-selection")
        .filter({ hasText: author.user.nickname }),
    ).toBeVisible();
    await expect(
      page
        .locator(".comment-search-selection")
        .filter({ hasText: event.title }),
    ).toBeVisible();
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
    await page
      .locator(".comment-filter-panel")
      .screenshot({ path: `test-results/admin-comment-panel-${width}.png` });
    if (width >= 768) {
      const inputs = await Promise.all([
        eventSearch.boundingBox(),
        userSearch.boundingBox(),
      ]);
      expect(Math.abs(inputs[0]!.y - inputs[1]!.y)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(inputs[0]!.height - inputs[1]!.height),
      ).toBeLessThanOrEqual(1);
    }
    await page.getByRole("button", { name: "Сбросить: Пользователь" }).click();
    await expect(
      page.getByText("Сообщение другого автора", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Применить фильтры" }).click();
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
