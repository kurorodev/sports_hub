import { test, expect, type Page } from "@playwright/test";
import { signInAs } from "./approval";
import {
  setupModerationEvent,
  sendDiscussion,
  findModerationEvent,
} from "./moderation";

async function openNotifications(page: Page) {
  await page.getByRole("button", { name: /^Уведомления/ }).click();
  return page.getByRole("dialog", { name: "Уведомления", exact: true });
}
export function notificationScenarios(
  owner: string,
  participant: string,
  label: string,
) {
  for (const width of [375, 768, 1440]) {
    test(`${label}: personal reasons, statuses, read state and keyboard at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 1000 });
      await page.context().route(/^https:\/\//, (route) => route.abort());
      await signInAs(page, owner);
      const title = `Уведомления ${label} ${width} ${Date.now()}`;
      const event = await setupModerationEvent(page, title);
      const url = `/events/${event.id}`;
      const ownerReason = `Уточните место встречи ${event.id}`;
      const commentReason = `Комментарий нарушает правила ${event.id}`;
      const commentText =
        width === 375
          ? `Вопрос ${event.id}\n`.padEnd(2000, "я")
          : `Вопрос ${event.id}\nМожно прийти без опыта?`;
      await signInAs(page, participant);
      await page.goto(url);
      await page
        .getByRole("button", { name: "Присоединиться", exact: true })
        .click();
      await expect(
        page.getByText("Вы участвуете", { exact: true }),
      ).toBeVisible();
      await sendDiscussion(page, commentText);
      let dialog = await openNotifications(page);
      const joined = dialog
        .locator(".notification-item")
        .filter({ hasText: title })
        .filter({ hasText: "Участие подтверждено" });
      await expect(joined).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Уведомления/ }),
      ).toBeFocused();
      await signInAs(page, "admin");
      await page.goto(`/admin?section=comments&eventId=${event.id}`);
      const comment = page
        .getByRole("article")
        .filter({ hasText: `Вопрос ${event.id}` });
      await comment
        .getByRole("button", { name: "Скрыть комментарий", exact: true })
        .click();
      await comment
        .getByLabel("Причина модерации", { exact: true })
        .fill(commentReason);
      await comment
        .getByRole("button", {
          name: "Подтвердить: скрыть комментарий",
          exact: true,
        })
        .click();
      await expect(comment).toContainText("Скрыт");
      const row = await findModerationEvent(page, title);
      await row
        .getByRole("button", { name: "Снять с публикации", exact: true })
        .click();
      await row
        .getByLabel("Причина модерации", { exact: true })
        .fill(ownerReason);
      await row
        .getByRole("button", {
          name: "Подтвердить: снять с публикации",
          exact: true,
        })
        .click();
      await expect(
        page.getByText(/снято с публикации. Решение сохранено/),
      ).toBeVisible();
      await signInAs(page, owner);
      await page.goto(url);
      await expect(
        page.getByText("Запись закрыта · Снято с публикации", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(ownerReason, { exact: true })).toHaveCount(0);
      dialog = await openNotifications(page);
      let notice = dialog
        .locator(".notification-item")
        .filter({ hasText: ownerReason });
      await expect(notice).toContainText("Мероприятие снято с публикации");
      await expect(
        dialog.getByText(commentReason, { exact: false }),
      ).toHaveCount(0);
      await notice
        .getByRole("button", { name: "Прочитано", exact: true })
        .click();
      await expect(notice.getByText("Новое", { exact: true })).toHaveCount(0);
      await page.screenshot({
        path: `test-results/notifications-${label}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.reload();
      dialog = await openNotifications(page);
      notice = dialog
        .locator(".notification-item")
        .filter({ hasText: ownerReason });
      await expect(notice).toBeVisible();
      await expect(notice.getByText("Новое", { exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await signInAs(page, participant);
      await page.goto(url);
      await expect(page.getByText(commentReason, { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByText(`Вопрос ${event.id}`, { exact: true }),
      ).toHaveCount(0);
      dialog = await openNotifications(page);
      const blockedComment = dialog
        .locator(".notification-item")
        .filter({ hasText: commentReason });
      await expect(blockedComment).toBeVisible();
      await expect(
        blockedComment.getByRole("blockquote", { name: "Скрытый комментарий" }),
      ).toContainText(`Вопрос ${event.id}`);
      await expect(blockedComment).toContainText(title);
      await expect(blockedComment.locator("blockquote p")).toHaveText(
        commentText,
      );
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/notifications-comment-${label}-${width}.png`,
        fullPage: true,
      });
      await expect(dialog.getByText(ownerReason, { exact: false })).toHaveCount(
        0,
      );
      await dialog
        .getByRole("button", { name: "Прочитать все", exact: true })
        .click();
      await expect(
        dialog.getByText("Всё прочитано", { exact: true }),
      ).toBeVisible();
      await expect(
        blockedComment.getByRole("blockquote", { name: "Скрытый комментарий" }),
      ).toContainText(`Вопрос ${event.id}`);
      await dialog
        .getByRole("button", { name: "Закрыть уведомления", exact: true })
        .click();
      await page.reload();
      dialog = await openNotifications(page);
      await expect(
        dialog.getByText("Всё прочитано", { exact: true }),
      ).toBeVisible();
      await expect(
        blockedComment.getByRole("blockquote", { name: "Скрытый комментарий" }),
      ).toContainText(`Вопрос ${event.id}`);
    });
  }
}
