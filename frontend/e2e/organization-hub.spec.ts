import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers/approval";

for (const width of [375, 768, 1440]) {
  test(`organization cabinet: navigation, search and application at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/organizations");
    const header = page.getByRole("navigation", { name: "Основная навигация" });
    const navigation = page.getByRole("navigation", {
      name: "Разделы организаций",
    });
    await expect(
      header.getByRole("link", { name: "Организации", exact: true }),
    ).toHaveCount(1);
    await expect(
      header.getByRole("link", { name: "Организация", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: "Организации" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Название организации", { exact: true }),
    ).toHaveCount(0);
    await navigation.getByRole("link", { name: "Мои организации" }).click();
    await expect(
      page.getByRole("link", { name: "Войти в аккаунт", exact: true }),
    ).toBeVisible();
    await signInAs(page, "user-alex");
    await page.goto("/organizations?q=Темп");
    await expect(
      page.getByLabel("Название или описание организации"),
    ).toHaveValue("Темп");
    await page.screenshot({
      path: `test-results/organization-hub-directory-${width}.png`,
      fullPage: true,
    });
    await navigation.getByRole("link", { name: "Мои организации" }).click();
    await expect(
      page.getByRole("heading", { name: "Мои организации", exact: true }),
    ).toBeVisible();
    await navigation.getByRole("link", { name: "Все организации" }).click();
    await expect(
      page.getByLabel("Название или описание организации"),
    ).toHaveValue("Темп");
    await page
      .getByRole("link", { name: "Добавить организацию", exact: true })
      .click();
    const name = `Мой клуб ${width} ${Date.now()}`;
    await page.getByLabel("Название организации", { exact: true }).fill(name);
    await page
      .getByLabel("О вашей организации", { exact: true })
      .fill(
        "Проводим совместные тренировки для начинающих и любителей спорта.",
      );
    const sportSearch = page.getByLabel("Найти вид спорта организации", {
      exact: true,
    });
    await expect(
      page.getByText("Начните вводить название вида спорта."),
    ).toBeVisible();
    await sportSearch.fill("шахматы");
    await page.getByLabel("Шахматы", { exact: true }).check();
    await sportSearch.fill("атлетика");
    await page.getByLabel("Легкая атлетика", { exact: true }).check();
    await sportSearch.clear();
    await expect(page.getByLabel("Шахматы", { exact: true })).toBeChecked();
    await expect(
      page.getByLabel("Легкая атлетика", { exact: true }),
    ).toBeChecked();
    await page.screenshot({
      path: `test-results/organization-hub-application-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: "Отправить заявку организации",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("article", { name: `Организация: ${name}`, exact: true }),
    ).toContainText("Заявка на рассмотрении");
    await expect(
      page.getByLabel("Название организации", { exact: true }),
    ).toHaveCount(0);
    await page.goto("/organization");
    await expect(page).toHaveURL("/organizations?view=mine");
    await expect(
      page.getByRole("article", { name: `Организация: ${name}`, exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/organization-hub-mine-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
