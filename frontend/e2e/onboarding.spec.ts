import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [375, 1440]) {
  test(`first visit, completion and replay at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const guide = page.locator(".site-guide-dialog");
    await expect(guide).toBeVisible();
    await expect(
      guide.getByRole("heading", { name: "Найдите интересную встречу" }),
    ).toBeFocused();
    await expect(
      guide.getByRole("button", { name: "Назад", exact: true }),
    ).toBeDisabled();
    expect(
      await guide.evaluate(
        (el) => el.getBoundingClientRect().width <= innerWidth,
      ),
    ).toBe(true);
    await guide.screenshot({
      path: `test-results/onboarding-first-${width}.png`,
    });
    await guide.getByRole("button", { name: "Далее", exact: true }).click();
    await expect(
      guide.getByRole("heading", { name: "Присоединяйтесь и общайтесь" }),
    ).toBeVisible();
    await guide.getByRole("button", { name: "Назад", exact: true }).click();
    await expect(
      guide.getByRole("heading", { name: "Найдите интересную встречу" }),
    ).toBeVisible();
    for (let index = 0; index < 4; index++)
      await guide.getByRole("button", { name: "Далее", exact: true }).click();
    await expect(
      guide.getByRole("heading", { name: "Настройте сайт под себя" }),
    ).toBeVisible();
    await expect(
      guide.getByRole("button", { name: "Всё понятно", exact: true }),
    ).toBeInViewport();
    await guide
      .getByRole("button", { name: "Всё понятно", exact: true })
      .click();
    await expect(guide).toHaveCount(0);
    await page.reload();
    await expect(guide).toHaveCount(0);
    const replay = page.getByRole("button", {
      name: "Как пользоваться сайтом",
      exact: true,
    });
    await replay.click();
    await expect(
      guide.getByRole("heading", { name: "Найдите интересную встречу" }),
    ).toBeVisible();
    await guide
      .getByRole("button", { name: "Пропустить обучение", exact: true })
      .click();
    await expect(guide).toHaveCount(0);
    await expect(replay).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("English dark theme, Escape and dismiss persistence on a direct link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "sport.interface.v1",
      JSON.stringify({ locale: "en", theme: "dark" }),
    ),
  );
  await page.goto("/support");
  const guide = page.locator(".site-guide-dialog");
  await expect(
    guide.getByRole("heading", { name: "Find an event you like" }),
  ).toBeVisible();
  await expect(
    guide.getByRole("button", { name: "Skip the tour" }),
  ).toBeInViewport();
  await guide.screenshot({ path: "test-results/onboarding-dark-en.png" });
  await page.keyboard.press("Escape");
  await expect(guide).toHaveCount(0);
  await expect(page).toHaveURL(/\/support$/);
  await page.reload();
  await expect(guide).toHaveCount(0);
});

test("administrator sees moderation and support instead of participation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустить обучение" }).click();
  await signInAs(page, "admin");
  await page.evaluate(() =>
    localStorage.removeItem("sport.site-onboarding.v1"),
  );
  await page.reload();
  const guide = page.locator(".site-guide-dialog");
  await expect(guide.getByText("Шаг 1 из 4", { exact: true })).toBeVisible();
  await guide.getByRole("button", { name: "Далее", exact: true }).click();
  await guide.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "Управляйте модерацией" }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "Помогайте пользователям" }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Всё понятно", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("site introduction and new-account questionnaire are shown one at a time", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".site-guide-dialog")).toBeVisible();
  const registered = await page.evaluate(async () => {
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: `site-tour-${Date.now()}`,
        displayName: "Новый пользователь",
        password: "test-password-2026",
      }),
    });
    return response.status;
  });
  expect(registered).toBe(201);
  await page.reload();
  await expect(page.locator(".site-guide-dialog")).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.locator(".questionnaire-dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Пропустить обучение" }).click();
  await expect(
    page.getByRole("dialog", { name: "Найдём спорт по душе" }),
  ).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
});
