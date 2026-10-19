import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[value="athlete-c"]').check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/");
}
async function manualPoint(page: Page) {
  await page.getByRole("button", { name: "Указать на карте" }).click();
  await page.locator(".location-picker .leaflet-container").click();
  // This suite runs with the provider disabled; only geocoding degrades, Java stays real.
  await expect(
    page.getByText(/Поиск адресов недоступен. Заполните город/),
  ).toBeVisible();
  await page.getByLabel("Город", { exact: true }).fill("Самара");
  await page
    .getByRole("combobox", { name: /Место встречи|Адрес площадки/ })
    .fill("площадь Куйбышева · точка для проверки");
  await page.getByRole("button", { name: "Подтвердить адрес точки" }).click();
}
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
});
test("Java map: disabled geocoder keeps event creation with a pin working", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await login(page);
  await page.goto("/events/new");
  const title = `Встреча с точкой Java ${Date.now()}`;
  await page.getByLabel("Название встречи", { exact: true }).fill(title);
  await page
    .getByLabel("Вид спорта", { exact: true })
    .selectOption({ label: "Бег" });
  await page
    .getByLabel("О встрече", { exact: true })
    .fill("Знакомимся и занимаемся вместе на выбранной точке карты.");
  await manualPoint(page);
  await page
    .getByLabel("Дата", { exact: true })
    .fill(new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10));
  await page.getByLabel("Время", { exact: true }).fill("18:00");
  const posted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/events") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Опубликовать встречу" }).click();
  const response = await posted;
  expect(response.status()).toBe(201);
  expect(response.fromServiceWorker()).toBe(false);
  const event = await response.json();
  expect(typeof event.location.latitude).toBe("number");
  expect(typeof event.location.longitude).toBe("number");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const detail = page.url();
  await page.getByRole("link", { name: "Карта", exact: true }).click();
  await page.getByLabel("Площадки", { exact: true }).uncheck();
  await page.getByTitle(`Мероприятие: ${title}`, { exact: true }).click();
  await page
    .locator(".leaflet-popup")
    .getByRole("link", { name: "Подробнее" })
    .click();
  await expect(page).toHaveURL(detail);
});
test("Java map: a new venue becomes LOW after a real report", async ({
  page,
}) => {
  await login(page);
  await page.goto("/map");
  await page
    .getByRole("button", { name: "Добавить площадку", exact: true })
    .click();
  const title = `Площадка Java ${Date.now()}`;
  await page.getByLabel("Название площадки", { exact: true }).fill(title);
  await manualPoint(page);
  const posted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/map/venues") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Сохранить площадку" }).click();
  const response = await posted;
  expect(response.status()).toBe(201);
  expect(response.fromServiceWorker()).toBe(false);
  const card = page
    .getByRole("region", { name: "Площадки в этой области" })
    .getByRole("article")
    .filter({ hasText: title });
  await expect(card).toContainText("Нет актуальных данных");
  await card.getByRole("button", { name: "Оценить загруженность" }).click();
  await page.getByLabel("Свободно / мало людей", { exact: true }).check();
  await page.getByLabel(/Сколько людей/).fill("5");
  await page.getByRole("button", { name: "Отправить оценку" }).click();
  await expect(
    page.getByText("Оценка загруженности сохранена", { exact: true }),
  ).toBeVisible();
  await expect(card).toContainText("Свободно / мало людей");
  await page.reload();
  await expect(card).toContainText("Свободно / мало людей");
});
