import { expect, type Page } from "@playwright/test";
export async function signInAs(page: Page, accountId: string) {
  await page.goto("/login");
  await page.locator(`input[value="${accountId}"]`).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/");
}
export async function createApproval(page: Page, title: string) {
  await page.goto("/events/new");
  await page.getByLabel("Название встречи", { exact: true }).fill(title);
  await page.getByLabel("Вид спорта", { exact: true }).click();
  await page.getByRole("option", { name: "Легкая атлетика", exact: true }).click();
  await page
    .getByLabel("О встрече", { exact: true })
    .fill(
      "Собираемся у входа в парк. Пробежка в спокойном темпе для новичков.",
    );
  await page.getByLabel("Город", { exact: true }).fill("Москва");
  await page
    .getByLabel("Место встречи", { exact: true })
    .fill("Парк, главный вход");
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Дата", { exact: true }).fill(date);
  await page.getByLabel("Время", { exact: true }).fill("18:30");
  await page.getByLabel("Количество мест", { exact: true }).fill("2");
  await page
    .getByLabel("Как присоединиться", { exact: true })
    .selectOption("APPROVAL");
  await page.getByRole("button", { name: "Опубликовать встречу" }).click();
  await expect(page.getByText("Встреча опубликована")).toBeVisible();
  return page.url();
}
export async function requestParticipation(page: Page, url: string) {
  await page.goto(url);
  await page
    .getByRole("button", { name: "Подать заявку", exact: true })
    .click();
  await expect(
    page.getByText("Ожидает решения", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 из 2 участников", { exact: true }),
  ).toBeVisible();
}
