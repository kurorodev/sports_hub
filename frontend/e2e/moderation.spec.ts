import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";
import {
  setupModerationEvent,
  sendDiscussion,
  findModerationEvent,
} from "./helpers/moderation";
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`S6 hides one comment, unpublishes and keeps interested access at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.clock.setFixedTime(new Date("2026-10-19T00:00:00Z"));
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-alex");
    const event = await setupModerationEvent(
      page,
      `Модерация пробежки ${width}`,
    );
    const url = `/events/${event.id}`;
    await signInAs(page, "user-maria");
    await page.goto(url);
    await page
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await sendDiscussion(page, "Проверяемый вопрос о встрече");
    await signInAs(page, "user-alex");
    await page.goto(url);
    await sendDiscussion(page, "Полезный ответ организатора");
    await signInAs(page, "admin");
    const row = await findModerationEvent(page, event.title);
    await row
      .getByRole("link", { name: "Комментарии мероприятия", exact: true })
      .click();
    const comment = page.getByRole("article", {
      name: "Комментарий: Мария",
      exact: true,
    });
    await comment
      .getByRole("button", { name: "Скрыть комментарий", exact: true })
      .click();
    await expect(
      page.getByLabel("Причина модерации", { exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", {
        name: "Подтвердить: скрыть комментарий",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Укажите причину: от 3 символов", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Причина модерации", { exact: true })
      .fill("Некорректная формулировка вопроса");
    await page
      .getByRole("button", {
        name: "Подтвердить: скрыть комментарий",
        exact: true,
      })
      .click();
    await expect(comment).toContainText("Скрыт модератором");
    await expect(
      page.getByText("Полезный ответ организатора", { exact: true }),
    ).toBeVisible();
    const eventRow = await findModerationEvent(page, event.title);
    await eventRow
      .getByRole("button", { name: "Снять с публикации", exact: true })
      .click();
    await page
      .getByLabel("Причина модерации", { exact: true })
      .fill("Условия встречи требуют уточнения.");
    await page
      .getByRole("button", {
        name: "Подтвердить: снять с публикации",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        `«${event.title}»: снято с публикации. Решение сохранено.`,
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByLabel("Статус мероприятий", { exact: true })
      .selectOption("UNPUBLISHED");
    await expect(eventRow).toContainText("Условия встречи требуют уточнения.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/moderation-admin-${width}.png`,
      fullPage: true,
    });
    await signInAs(page, "user-maria");
    await page.goto(url);
    await page.reload();
    await expect(
      page.getByText("Запись закрыта · Снято с публикации", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Условия встречи требуют уточнения.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Проверяемый вопрос о встрече", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Полезный ответ организатора", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Ваше сообщение", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/moderation-participant-${width}.png`,
      fullPage: true,
    });
    await signInAs(page, "user-alex");
    await page.goto(url);
    await expect(
      page.getByText("Условия встречи требуют уточнения.", { exact: true }),
    ).toBeVisible();
    await signInAs(page, "org-run");
    await page.goto(`/?q=${encodeURIComponent(event.title)}&includePast=true`);
    await expect(
      page.getByRole("heading", { name: event.title, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Пока без совпадений", { exact: true }),
    ).toBeVisible();
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: /сбились с маршрута/ }),
    ).toBeVisible();
  });
}
