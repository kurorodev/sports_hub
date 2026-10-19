import { test, expect } from "@playwright/test";
import { signInAs, createApproval } from "./helpers/approval";

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`S5 public question and organizer answer persist at ${width}px`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-10-19T00:00:00Z"));
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-alex");
    const url = await createApproval(page, `Обсуждение бега ${width}`);
    await signInAs(page, "user-maria");
    await page.goto(url);
    await expect(
      page.getByRole("button", { name: "Подать заявку", exact: true }),
    ).toBeVisible();
    const field = page.getByRole("textbox", { name: "Ваше сообщение" });
    await field.fill("Можно новичку? <b>Вопрос</b>");
    await field.press("Enter");
    await field.pressSequentially("Где встречаемся?");
    await page
      .getByRole("button", { name: "Отправить сообщение", exact: true })
      .click();
    await expect(
      page.getByText("Сообщение опубликовано.", { exact: true }),
    ).toBeVisible();
    const question = page.getByRole("article", {
      name: "Сообщение: Мария",
      exact: true,
    });
    await expect(question).toContainText("Можно новичку? <b>Вопрос</b>");
    await expect(question.locator(".comment-text b")).toHaveCount(0);
    await expect(field).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Подать заявку", exact: true }),
    ).toBeVisible();
    await signInAs(page, "user-alex");
    await page.goto(url);
    await expect(
      page.getByRole("article", { name: "Сообщение: Мария", exact: true }),
    ).toContainText("Где встречаемся?");
    await page
      .getByRole("textbox", { name: "Ваше сообщение" })
      .fill("Подойдёт! Ждём у главного входа в парк.");
    await page
      .getByRole("button", { name: "Отправить сообщение", exact: true })
      .click();
    await expect(page.getByText("Сообщений: 2", { exact: true })).toBeVisible();
    const answer = page.getByRole("article", {
      name: "Сообщение: Александр",
      exact: true,
    });
    await expect(
      answer.getByText("Организатор", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("article", { name: "Сообщение: Александр", exact: true }),
    ).toContainText("Ждём у главного входа");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator("#event-discussion")
      .screenshot({ path: `test-results/discussion-${width}.png` });
  });
}

test("guest login returns to the discussion and focuses its scenario", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-19T00:00:00Z"));
  await page.goto("/events/82e2dd5f-0000-4000-8000-000000000000");
  await page.getByRole("link", { name: "Войти и написать" }).click();
  await page.locator('input[value="user-maria"]').check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL(/\/events\/.+#event-discussion$/);
  await expect(
    page.getByRole("heading", { name: "Обсуждение встречи" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("textbox", { name: "Ваше сообщение" }),
  ).toBeVisible();
});
