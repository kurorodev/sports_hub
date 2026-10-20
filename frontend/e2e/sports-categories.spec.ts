import { selectCity } from "./helpers/cities";
import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

test("universal category photo is used before upload and after restoring the default", async ({
  page,
}) => {
  await signInAs(page, "admin");
  await page.goto("/admin?section=sports");
  const fallback = "/art/sports/default.png";
  const preview = page.getByRole("img", {
    name: "Предпросмотр фото категории",
    exact: true,
  });
  await expect(preview).toHaveAttribute("src", fallback);
  await expect
    .poll(() =>
      preview.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const name = "Универсальная категория";
  await page.getByLabel("Название вида спорта", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Создать категорию", exact: true })
    .click();
  await page.getByLabel("Поиск вида спорта", { exact: true }).fill(name);
  const row = page.getByRole("button", {
    name: `Редактировать: ${name}`,
    exact: true,
  });
  await expect(row.locator("img")).toHaveAttribute("src", fallback);
  await row.click();
  const editor = page.getByRole("dialog", {
    name: "Настройки категории",
    exact: true,
  });
  const photo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await editor
    .getByLabel("Заменить фото категории", { exact: true })
    .setInputFiles({
      name: "category.png",
      mimeType: "image/png",
      buffer: Buffer.from(photo, "base64"),
    });
  await editor
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(row.locator("img")).toHaveAttribute(
    "src",
    /\/api\/v1\/sports\//,
  );
  await row.click();
  await editor
    .getByRole("button", { name: "Вернуть стандартное фото", exact: true })
    .click();
  await expect(
    editor.getByRole("img", { name: `Фото категории: ${name}`, exact: true }),
  ).toHaveAttribute("src", fallback);
  await editor
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(row.locator("img")).toHaveAttribute("src", fallback);
  await page.getByLabel("Поиск вида спорта", { exact: true }).fill("Другое");
  await expect(
    page
      .getByRole("button", { name: "Редактировать: Другое", exact: true })
      .locator("img"),
  ).toHaveAttribute("src", fallback);
});

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
    await page
      .getByRole("option", { name: "Легкая атлетика", exact: true })
      .click();
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
    await selectCity(page, "Самара");
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
