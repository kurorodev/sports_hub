import { expect, test } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import type { Session } from "../../src/shared/api/types";

for (const width of [375, 1440]) {
  test(`admin support is queue-only and can process user tickets at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "athlete-a");
    const user: Session = await (
      await page.request.get("/api/v1/session")
    ).json();
    const payload = {
      category: "HELP",
      title: `Вопрос в поддержку ${width} ${Date.now()}`,
      description: "Помогите разобраться с записью на спортивную встречу.",
    };
    const created = await page.request.post("/api/v1/support/tickets", {
      data: payload,
      headers: { "X-CSRF-Token": user.csrfToken },
    });
    expect(created.status()).toBe(201);
    const ticket = await created.json();
    await signInAs(page, "admin");
    await page.goto("/support");
    await expect(
      page.getByRole("heading", { name: "Очередь поддержки" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Быстрые ответы" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Мои обращения" }),
    ).toHaveCount(0);
    await expect(page.locator('a[href^="/support/new"]')).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Обращения поддержки" }),
    ).toHaveCount(0);
    await page.getByLabel("Поиск обращений").fill(payload.title);
    await page.getByRole("button", { name: "Найти", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: payload.title }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/admin-support-${width}.png`,
      fullPage: true,
    });
    const admin: Session = await (
      await page.request.get("/api/v1/session")
    ).json();
    expect(
      (
        await page.request.post("/api/v1/support/tickets", {
          data: payload,
          headers: { "X-CSRF-Token": admin.csrfToken },
        })
      ).status(),
    ).toBe(403);
    expect((await page.request.get("/api/v1/support/tickets")).status()).toBe(
      403,
    );
    await page.goto("/support/new?category=IDEA");
    await expect(page).toHaveURL("/support");
    await expect(
      page.getByRole("heading", { name: "Очередь поддержки" }),
    ).toBeVisible();
    await page.goto(`/support/${ticket.id}`);
    await page
      .getByRole("textbox", { name: "Ответ пользователю", exact: true })
      .fill("Ответ службы поддержки пользователю.");
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
      .getByRole("button", { name: "Сохранить изменения", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Открыть повторно", exact: true }),
    ).toBeVisible();
    await signInAs(page, "athlete-a");
    await page.goto("/support");
    await expect(
      page.getByRole("heading", { name: "Быстрые ответы" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Помочь разобраться/ }),
    ).toBeVisible();
    await page.goto(`/support/${ticket.id}`);
    await expect(
      page.getByText("Ответ службы поддержки пользователю.", { exact: true }),
    ).toBeVisible();
  });
}
