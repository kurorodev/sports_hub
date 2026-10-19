import { test, expect } from "@playwright/test";
import {
  signInAs,
  createApproval,
  requestParticipation,
} from "./helpers/approval";

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`S4 both decisions persist, fit and remain private at ${width}px`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-10-19T00:00:00Z"));
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-alex");
    const url = await createApproval(page, `Заявки на бег ${width}`);
    await expect(
      page.getByText("Нет заявок, ожидающих решения."),
    ).toBeVisible();
    const emptyAction = page.getByRole("button", { name: "Новых заявок нет" });
    await expect(emptyAction).toBeDisabled();
    await expect(emptyAction).toHaveCSS("background-color", "rgb(239, 239, 237)");
    await emptyAction.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    await emptyAction.click({ force: true });
    expect(new URL(page.url()).hash).toBe("");
    expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
    await signInAs(page, "user-maria");
    await requestParticipation(page, url);
    await page.reload();
    await expect(
      page.getByText("Ожидает решения", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Заявки на участие" }),
    ).toHaveCount(0);
    await signInAs(page, "admin");
    await requestParticipation(page, url);
    await signInAs(page, "user-alex");
    await page.goto(url);
    const requests = page.getByRole("list", { name: "Заявки на участие" });
    await expect(requests.getByRole("listitem")).toHaveCount(2);
    const reviewAction = page.getByRole("link", { name: "Рассмотреть заявки" });
    await expect(reviewAction).toHaveCSS("background-color", "rgb(255, 204, 22)");
    await reviewAction.click();
    await expect(
      page.getByRole("heading", { name: "Заявки на участие" }),
    ).toBeInViewport();
    await requests
      .getByRole("listitem", { name: "Заявка: Мария", exact: true })
      .getByRole("button", { name: "Одобрить", exact: true })
      .click();
    await expect(
      page.getByText("Мария: одобрено. Решение сохранено."),
    ).toBeVisible();
    await expect(
      page.getByText("1 из 2 участников", { exact: true }),
    ).toBeVisible();
    await expect(reviewAction).toBeVisible();
    await requests
      .getByRole("listitem", { name: "Заявка: Администратор", exact: true })
      .getByRole("button", { name: "Отклонить", exact: true })
      .click();
    await expect(
      page.getByLabel("Причина отказа (необязательно)"),
    ).toBeFocused();
    await page
      .getByLabel("Причина отказа (необязательно)")
      .fill("Группа для новичков, предложим другую встречу.");
    await page
      .getByRole("button", { name: "Подтвердить отказ", exact: true })
      .click();
    await expect(
      page.getByText("Нет заявок, ожидающих решения."),
    ).toBeVisible();
    await expect(emptyAction).toBeDisabled();
    await expect(reviewAction).toHaveCount(0);
    await page.getByLabel("Статус заявок").selectOption("CONFIRMED");
    await expect(requests.getByText("Мария", { exact: true })).toBeVisible();
    await page.getByLabel("Статус заявок").selectOption("REJECTED");
    await expect(
      requests.getByText("Администратор", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/approval-organizer-${width}.png`,
      fullPage: true,
    });
    await signInAs(page, "admin");
    await page.goto(url);
    await page.reload();
    await expect(
      page.getByText("Заявка отклонена", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Группа для новичков, предложим другую встречу.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Подать заявку", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Заявки на участие" }),
    ).toHaveCount(0);
    await signInAs(page, "user-maria");
    await page.goto(url);
    await page.reload();
    await expect(
      page.getByText("Заявка одобрена. До встречи!", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "Кто идёт" })
        .getByText("Мария", { exact: true }),
    ).toBeVisible();
  });
}
