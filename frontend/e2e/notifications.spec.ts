import { notificationScenarios } from "./helpers/notifications";
import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

notificationScenarios("user-alex", "user-maria", "mock notifications");

for (const width of [375, 1440]) {
  test(`notification list scrolls without growing and a full comment fits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-alex");
    const comment =
      "Собираемся у главного входа. Возьмите удобную обувь и воду. "
        .repeat(5)
        .trim();
    await page.evaluate(async (commentText) => {
      const session = await (await fetch("/api/v1/session")).json();
      const now = Date.now();
      localStorage.setItem(
        "sport.mock.notifications.v1",
        JSON.stringify(
          Array.from({ length: 45 }, (_, i) => ({
            id: crypto.randomUUID(),
            recipientId: session.user.id,
            dedupeKey: `scroll-fixture-${i}`,
            type: i === 0 ? "COMMENT_HIDDEN" : "EVENT_STATUS",
            title: i === 0 ? "Комментарий скрыт" : `Обновление встречи ${i}`,
            text: "Встреча в парке",
            commentText: i === 0 ? commentText : null,
            reason:
              i === 0 ? "Используйте обсуждение для вопросов о встрече." : null,
            href: null,
            createdAt: new Date(now - i * 1000).toISOString(),
            readAt: null,
          })),
        ),
      );
    }, comment);
    await page.reload();
    const bell = page.getByRole("button", {
      name: "Уведомления: 45 непрочитанных",
    });
    await bell.click();
    const dialog = page.getByRole("dialog", {
      name: "Уведомления",
      exact: true,
    });
    await expect(
      dialog.getByText("Всё прочитано", { exact: true }),
    ).toBeVisible();
    const scroller = dialog.getByRole("region", { name: "Список уведомлений" });
    const card = dialog.locator(".notification-item").first();
    await expect(card.locator("blockquote p")).toHaveText(comment);
    const listBox = (await scroller.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.y).toBeGreaterThanOrEqual(listBox.y);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(
      listBox.y + listBox.height,
    );
    expect(
      await scroller.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    const before = (await dialog.boundingBox())!;
    await dialog
      .getByRole("button", { name: "Показать ещё", exact: true })
      .click();
    await expect(dialog.locator(".notification-item")).toHaveCount(40);
    const after = (await dialog.boundingBox())!;
    expect(after.height).toBeCloseTo(before.height, 0);
    expect(
      await dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Закрыть уведомления" }),
    ).toBeInViewport();
    await scroller.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({
      path: `test-results/notification-scroll-${width}.png`,
    });
  });
}
