import { selectCity } from "./cities";
import { test, expect, type Page } from "@playwright/test";
import { signInAs } from "./approval";
import { setupModerationEvent, sendDiscussion } from "./moderation";

async function newUser(page: Page) {
  const nickname = `support-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await page.goto("/register");
  await expect(page.locator(".header-account")).not.toContainText("Сессия");
  await page.getByLabel("Никнейм", { exact: true }).fill(nickname);
  await page.getByLabel("Пароль", { exact: true }).fill("Support-QA-password");
  await page
    .getByLabel("Имя в профиле", { exact: true })
    .fill("Участник поддержки");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(page).toHaveURL("/profile");
  await page.getByRole("button", { name: "Пропустить, заполню позже" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return nickname;
}
async function returnUser(page: Page, nickname: string) {
  await page.goto("/login");
  await expect(page.locator(".header-account")).not.toContainText("Сессия");
  await page.getByLabel("Никнейм", { exact: true }).fill(nickname);
  await page.getByLabel("Пароль", { exact: true }).fill("Support-QA-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL("/");
}
async function fromBell(page: Page, title: string, notificationTitle: string) {
  await page.getByRole("button", { name: /^Уведомления/ }).click();
  const dialog = page.getByRole("dialog", { name: "Уведомления", exact: true });
  await dialog
    .locator(".notification-item")
    .filter({ hasText: title })
    .filter({
      has: page.getByRole("heading", { name: notificationTitle, exact: true }),
    })
    .first()
    .getByRole("link", { name: "Открыть", exact: true })
    .click();
  await expect(page).toHaveURL(/\/support\/[a-f0-9-]{36}$/);
}
async function withinViewport(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
export function supportScenarios(owner: string, label: string) {
  for (const width of [375, 768, 1440]) {
    test(`${label}: help, admin reply, notification, reopening and venue suggestion at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 1000 });
      const nickname = await newUser(page);
      await page
        .getByRole("link", { name: "Техническая поддержка", exact: true })
        .first()
        .click();
      await expect(
        page.getByRole("heading", { name: "Центр поддержки", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: /Помочь разобраться/ }).click();
      const title = `Помощь ${label} ${width} ${Date.now()}`;
      await page
        .getByRole("textbox", { name: "Заголовок", exact: true })
        .fill(title);
      await page
        .getByRole("textbox", { name: /Подробности/ })
        .fill("Не получается записаться на встречу. Помогите разобраться.");
      await page
        .getByRole("button", { name: "Отправить обращение", exact: true })
        .click();
      await expect(page).toHaveURL(/\/support\/[a-f0-9-]{36}$/);
      const url = page.url();
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await withinViewport(page);
      await signInAs(page, "admin");
      await fromBell(page, title, "Новое обращение в поддержку");
      await page
        .getByRole("textbox", { name: "Ответ пользователю", exact: true })
        .fill("Поможем! Уточните название встречи.");
      await page
        .getByRole("button", { name: "Отправить ответ", exact: true })
        .click();
      await expect(
        page.getByText("Сообщение отправлено", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("combobox", { name: "Изменить статус", exact: true })
        .selectOption("RESOLVED");
      await page
        .getByRole("combobox", { name: "Приоритет обращения", exact: true })
        .selectOption("HIGH");
      await page
        .getByRole("button", { name: "Сохранить изменения", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Открыть повторно", exact: true }),
      ).toBeVisible();
      await withinViewport(page);
      await returnUser(page, nickname);
      await fromBell(page, title, "Ответ службы поддержки");
      await expect(
        page.getByText("Поможем! Уточните название встречи.", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByText("Поможем! Уточните название встречи.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Открыть повторно", exact: true })
        .click();
      await page
        .getByRole("textbox", {
          name: "Ваше сообщение в поддержку",
          exact: true,
        })
        .fill("Проблема осталась, название встречи: Бег в парке.");
      await page
        .getByRole("button", { name: "Отправить ответ", exact: true })
        .click();
      await expect(
        page.getByText("Сообщение отправлено", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Вопрос решён, закрыть", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Открыть повторно", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/support-${label}-${width}.png`,
        fullPage: true,
      });
      await withinViewport(page);
      await page.goto("/support/new?category=VENUE_SUGGESTION");
      await page
        .getByLabel("Название площадки", { exact: true })
        .fill(`Площадка ${width}`);
      await selectCity(page, "Красноярск", "Город площадки");
      await page
        .getByLabel("Адрес площадки", { exact: true })
        .fill("Парк, у главного входа");
      await page
        .getByRole("textbox", { name: /Подробности/ })
        .fill("Баскетбольная площадка, вход бесплатный, два кольца.");
      await page
        .getByRole("button", { name: "Отправить обращение", exact: true })
        .click();
      await expect(
        page.getByText("Красноярск · Парк, у главного входа", { exact: true }),
      ).toBeVisible();
      await signInAs(page, owner);
      await page.goto(url);
      await expect(
        page.getByText(/Обращение не найдено или недоступно/),
      ).toBeVisible();
    });
    test(`${label}: comment report reaches admin with snapshot and moderation link at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 1000 });
      await signInAs(page, owner);
      const event = await setupModerationEvent(
        page,
        `Жалоба ${label} ${width} ${Date.now()}`,
      );
      await page.goto(`/events/${event.id}`);
      const text = `Проверяем жалобу ${event.id}`;
      await sendDiscussion(page, text);
      await newUser(page);
      await page.goto(`/events/${event.id}`);
      const message = page.getByRole("article").filter({ hasText: text });
      await message
        .getByRole("button", { name: "Пожаловаться", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Пожаловаться на комментарий",
        exact: true,
      });
      await expect(dialog.getByText(text, { exact: true })).toBeVisible();
      await dialog.getByLabel("Причина жалобы").selectOption("SPAM");
      await dialog
        .getByRole("textbox", { name: /Подробности/ })
        .fill("В сообщении спам и подозрительная реклама, прошу проверить.");
      await dialog
        .getByRole("button", { name: "Отправить жалобу", exact: true })
        .click();
      await expect(page).toHaveURL(/\/support\/[a-f0-9-]{36}$/);
      const ticket = page.url();
      await expect(page.getByText(text, { exact: true })).toBeVisible();
      await page.goto(`/events/${event.id}`);
      await expect(
        page.locator(".comment-text").getByText(text, { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("article")
        .filter({ hasText: text })
        .getByRole("button", { name: "Пожаловаться", exact: true })
        .click();
      const duplicate = page.getByRole("dialog", {
        name: "Пожаловаться на комментарий",
        exact: true,
      });
      await duplicate
        .getByRole("textbox", { name: /Подробности/ })
        .fill("Повторная проверка той же жалобы на спам.");
      await duplicate
        .getByRole("button", { name: "Отправить жалобу", exact: true })
        .click();
      await expect(duplicate.getByRole("alert")).toContainText(
        "Вы уже сообщили об этом комментарии",
      );
      await page.keyboard.press("Escape");
      await signInAs(page, "admin");
      await fromBell(
        page,
        "Жалоба на комментарий",
        "Новая жалоба на комментарий",
      );
      await expect(page).toHaveURL(ticket);
      await expect(page.getByText(text, { exact: true })).toBeVisible();
      await page
        .getByRole("link", {
          name: "Перейти к модерации комментария",
          exact: true,
        })
        .click();
      const row = page.getByRole("article").filter({ hasText: text });
      await row
        .getByRole("button", { name: "Скрыть комментарий", exact: true })
        .click();
      await row
        .getByLabel("Причина модерации", { exact: true })
        .fill("Спам подтверждён по жалобе");
      await row
        .getByRole("button", {
          name: "Подтвердить: скрыть комментарий",
          exact: true,
        })
        .click();
      await expect(row).toContainText("Скрыт");
      await page.goto(ticket);
      await expect(page.getByText(text, { exact: true })).toBeVisible();
      await page
        .getByRole("combobox", { name: "Изменить статус", exact: true })
        .selectOption("RESOLVED");
      await page
        .getByRole("button", { name: "Сохранить изменения", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Открыть повторно", exact: true }),
      ).toBeVisible();
      await withinViewport(page);
    });
  }
}
