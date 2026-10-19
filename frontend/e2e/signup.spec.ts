import { test, expect } from "@playwright/test";

test("mock signup persists a separate account across reload and demo switching", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto("/register");
  const name = `Новый участник ${Date.now()}`;
  await page.getByLabel("Никнейм", { exact: true }).fill(`new-${Date.now()}`);
  await page.getByLabel("Имя в профиле", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await page
    .getByRole("link", { name: "Посмотреть публичный профиль", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await page.goto("/login");
  await page.getByRole("radio", { name: /Александр/ }).check();
  await page
    .getByRole("button", { name: "Войти в аккаунт", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await page.goto("/login?next=profile");
  await page.getByRole("radio", { name: new RegExp(name) }).check();
  await page
    .getByRole("button", { name: "Войти в аккаунт", exact: true })
    .click();
  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
