import { selectCity } from "../helpers/cities";
import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import { findModerationEvent } from "../helpers/moderation";
import type { Session } from "../../src/shared/api/types";

test("registration retains the first field across repeated client navigation", async ({
  page,
}) => {
  await page.goto("/login?next=create-event");
  for (let round = 0; round < 10; round++) {
    await page
      .getByRole("link", { name: "Создать аккаунт", exact: true })
      .click();
    await page
      .getByRole("group", { name: "Данные нового аккаунта", exact: true })
      .getByLabel("Никнейм", { exact: true })
      .fill(`input-${round}`);
    await page
      .getByLabel("Имя в профиле", { exact: true })
      .fill("Проверка ввода");
    await page.getByLabel("Пароль", { exact: true }).fill("valid-password");
    await expect(page.getByLabel("Никнейм", { exact: true })).toHaveValue(
      `input-${round}`,
    );
    await page
      .getByRole("main")
      .getByRole("link", { name: "Войти", exact: true })
      .click();
  }
});

for (const width of [375, 768, 1440]) {
  test(`Java signup: new profile, conditions and organizer navigation at ${width}px`, async ({
    page,
    browser,
    context,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    const suffix = `${width}-${Date.now()}`;
    const name = `Участник ${suffix}`;
    const nickname = `signup-${suffix}`;
    const password = "test-password-2026";
    await page.goto("/login?next=create-event");
    await page
      .getByRole("link", { name: "Создать аккаунт", exact: true })
      .click();
    await expect(page).toHaveURL(/\/register\?next=create-event$/);
    await page
      .getByRole("group", { name: "Данные нового аккаунта", exact: true })
      .getByLabel("Никнейм", { exact: true })
      .fill("athlete-a");
    await page.getByLabel("Имя в профиле", { exact: true }).fill(name);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Создать аккаунт", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Никнейм уже занят");
    await expect(page.getByLabel("Имя в профиле", { exact: true })).toHaveValue(
      name,
    );
    await page.getByLabel("Никнейм", { exact: true }).fill(nickname);
    await page.screenshot({
      path: `test-results/java-signup-${width}.png`,
      fullPage: true,
    });
    const posted = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/auth/register") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Создать аккаунт", exact: true })
      .click();
    const response = await posted;
    expect(response.status()).toBe(201);
    expect(response.fromServiceWorker()).toBe(false);
    const session: Session = await response.json();
    expect(session.systemRoles).toEqual(["USER"]);
    expect(
      (await context.cookies()).find((c) => c.name === "SPORT_SESSION")
        ?.httpOnly,
    ).toBe(true);
    await expect(page).toHaveURL("/events/new");
    await page
      .getByRole("button", { name: "Пропустить, заполню позже" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".header-account")).toContainText(name);
    const title = `Новая встреча ${suffix}`;
    const requirements =
      "Возьмите воду и удобную обувь.\n<strong>Это обычный текст</strong>";
    await page.getByLabel("Название встречи", { exact: true }).fill(title);
    await page.getByLabel("Вид спорта", { exact: true }).click();
    await page
      .getByRole("option", { name: "Легкая атлетика", exact: true })
      .click();
    await page
      .getByLabel("О встрече", { exact: true })
      .fill("Знакомимся и бежим в парке в спокойном темпе.");
    await page
      .getByLabel("Условия участия", { exact: true })
      .fill(requirements);
    await selectCity(page, "Красноярск");
    await page
      .getByLabel("Место встречи", { exact: true })
      .fill("Главный вход в парк");
    await page
      .getByLabel("Дата", { exact: true })
      .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    await page.getByLabel("Время", { exact: true }).fill("18:30");
    const published = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/events") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Опубликовать встречу", exact: true })
      .click();
    const eventResponse = await published;
    expect(eventResponse.status()).toBe(201);
    const event = await eventResponse.json();
    expect(event.requirements).toBe(requirements);
    expect(event.organizer.id).toBe(session.user.id);
    await expect(page).toHaveURL(`/events/${event.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Условия участия" }),
    ).toContainText(requirements);
    expect(
      await page
        .getByRole("region", { name: "Условия участия" })
        .locator("strong")
        .count(),
    ).toBe(0);
    const messageField = page.getByRole("textbox", {
      name: "Ваше сообщение",
      exact: true,
    });
    await messageField.fill("Привет, @athlete");
    await page
      .getByRole("option")
      .filter({ hasText: "@athlete-b" })
      .getByRole("button")
      .click();
    await messageField.press("End");
    await messageField.pressSequentially("Присоединишься?");
    const commented = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/v1/events/${event.id}/comments`) &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Отправить сообщение", exact: true })
      .click();
    const commentResponse = await commented;
    expect(commentResponse.status()).toBe(201);
    const comment = await commentResponse.json();
    expect(comment.mentions).toHaveLength(1);
    const mention = comment.mentions[0];
    expect(mention.nickname).toBe("athlete-b");
    await expect(
      page
        .locator(".comment-text")
        .getByRole("link", { name: "@athlete-b", exact: true }),
    ).toHaveAttribute("href", `/users/${mention.userId}`);
    await page.screenshot({
      path: `test-results/java-mentions-${width}.png`,
      fullPage: true,
    });
    const guestContext = await browser.newContext({
      baseURL: "http://127.0.0.1:5174",
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
    });
    const adminContext = await browser.newContext({
      baseURL: "http://127.0.0.1:5174",
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
    });
    try {
      const guest = await guestContext.newPage();
      await guest.goto(`/events/${event.id}`);
      await expect(
        guest.getByRole("region", { name: "Условия участия" }),
      ).toContainText(requirements);
      const mentionLink = guest
        .locator(".comment-text")
        .getByRole("link", { name: "@athlete-b", exact: true });
      await expect(mentionLink).toHaveAttribute(
        "href",
        `/users/${mention.userId}`,
      );
      await mentionLink.click();
      await expect(guest).toHaveURL(`/users/${mention.userId}`);
      await guest.goto(`/events/${event.id}`);
      await guest
        .locator(".detail-summary")
        .getByRole("link", { name, exact: true })
        .click();
      await expect(guest.getByRole("heading", { level: 1 })).toHaveText(name);
      await guest.reload();
      await expect(guest.getByRole("heading", { level: 1 })).toHaveText(name);
      await expect(
        guest.getByRole("button", {
          name: "Редактировать профиль",
          exact: true,
        }),
      ).toHaveCount(0);
      const admin = await adminContext.newPage();
      await signInAs(admin, "admin");
      const row = await findModerationEvent(admin, title);
      await row.getByRole("link", { name, exact: true }).click();
      await expect(admin.getByRole("heading", { level: 1 })).toHaveText(name);
      await guest.goto(`/?q=${encodeURIComponent(title)}`);
      await guest
        .getByRole("article")
        .filter({
          has: guest.getByRole("heading", { name: title, exact: true }),
        })
        .getByRole("link", { name, exact: true })
        .click();
      await expect(guest).toHaveURL(`/users/${session.user.id}`);
      expect(
        await guest.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await guestContext.close();
      await adminContext.close();
    }
    await page.goto("/profile");
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/login?next=profile");
    await page.getByLabel("Никнейм", { exact: true }).fill(`@${nickname}`);
    await page.getByLabel("Пароль", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Неверный никнейм или пароль",
    );
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL("/profile");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  });
}
