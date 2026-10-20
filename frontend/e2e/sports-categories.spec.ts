import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

for (const width of [375, 768, 1440]) {
  test(`official categories and Other stay fixed at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
    await page.context().route(/^https:\/\//, (route) => route.abort());
    await signInAs(page, "user-alex");
    const category = page.getByLabel("Вид спорта", { exact: true });
    await category.click();
    await expect(page.getByRole("option")).toHaveCount(202);
    await expect(
      page.getByRole("option", { name: "Другое", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("option", { name: "Легкая атлетика", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Утро. Парк. Лёгкий бег." }),
    ).toBeVisible();
    await page.goto("/events/new");
    const sport = page.getByLabel("Вид спорта", { exact: true });
    await sport.click();
    await expect(page.getByRole("option")).toHaveCount(202);
    await page.getByRole("option", { name: "Шахматы", exact: true }).click();
    await expect(
      page.getByLabel("Название активности", { exact: true }),
    ).toHaveCount(0);
    await sport.click();
    await page.getByRole("option", { name: "Другое", exact: true }).click();
    const label = `Новая активность ${width}`;
    await page.getByLabel("Название активности", { exact: true }).fill(label);
    await page
      .getByLabel("Название встречи", { exact: true })
      .fill(`Пробуем новое ${width}`);
    await page
      .getByLabel("О встрече", { exact: true })
      .fill("Встречаемся в парке, объясняем правила и играем вместе.");
    await page.getByLabel("Город", { exact: true }).fill("Самара");
    await page
      .getByLabel("Место встречи", { exact: true })
      .fill("Главный вход в парк");
    await page.getByLabel("Дата", { exact: true }).fill("2026-11-07");
    await page.getByLabel("Время", { exact: true }).fill("18:30");
    await page.getByRole("button", { name: "Опубликовать встречу" }).click();
    await expect(
      page.getByText(`Активность: ${label}`, { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(`Активность: ${label}`, { exact: true }),
    ).toBeVisible();
    await signInAs(page, "user-maria");
    await category.click();
    await page.getByRole("option", { name: "Другое", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: `Пробуем новое ${width}`,
        exact: true,
      }),
    ).toBeVisible();
    await category.click();
    await expect(page.getByRole("option")).toHaveCount(202);
    await expect(
      page.getByRole("option").filter({ hasText: label }),
    ).toHaveCount(0);
    await category.click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/categories-${width}.png`,
      fullPage: true,
    });
    await page.goto("/organizations?view=apply");
    const search = page.getByLabel("Найти вид спорта организации", {
      exact: true,
    });
    await search.fill("атлетика");
    await page.getByLabel("Легкая атлетика", { exact: true }).check();
    await search.fill("шахматы");
    await page.getByLabel("Шахматы", { exact: true }).check();
    await search.fill("");
    await expect(
      page.getByLabel("Легкая атлетика", { exact: true }),
    ).toBeChecked();
    await expect(page.getByLabel("Шахматы", { exact: true })).toBeChecked();
  });
}
