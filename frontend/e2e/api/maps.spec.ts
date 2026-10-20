import { selectCity } from "../helpers/cities";
import { familiarVisitorState } from "../helpers/site-onboarding";
import { test, expect, type Page } from "@playwright/test";
import { setupMapEvent } from "../helpers/maps";
import { signInAs } from "../helpers/approval";
import { findModerationEvent } from "../helpers/moderation";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[value="athlete-c"]').check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/");
}
async function manualPoint(page: Page) {
  await selectCity(page, "Самара");
  const address = page.getByRole("combobox", {
    name: /Место встречи|Адрес площадки/,
  });
  await address.fill("площадь Куйбышева · точка для проверки");
  await page.getByRole("button", { name: "Указать на карте" }).click();
  await page.locator(".location-picker .map-canvas").click();
  // Провайдер геопоиска отключён намеренно; остальные запросы продолжают идти в настоящий Java API.
  await expect(
    page.getByText(/Поиск адресов недоступен. Заполните город/),
  ).toBeVisible();
  await expect(page.getByLabel("Город", { exact: true })).toHaveText("Самара");
  await expect(address).toHaveValue("площадь Куйбышева · точка для проверки");
  await page.getByRole("button", { name: "Подтвердить адрес точки" }).click();
}
test.beforeEach(async ({ page }) => {
  await page
    .context()
    .route("https://tiles.openfreemap.org/**", (route) => route.abort());
});
test("Java map: disabled geocoder keeps event creation with a pin working", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await login(page);
  await page.goto("/events/new");
  const title = `Встреча с точкой Java ${Date.now()}`;
  await page.getByLabel("Название встречи", { exact: true }).fill(title);
  await page.getByLabel("Вид спорта", { exact: true }).click();
  await page
    .getByRole("option", { name: "Легкая атлетика", exact: true })
    .click();
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
  await expect(
    page.getByTitle(`Мероприятие: ${title}`, { exact: true }),
  ).toBeVisible();
  // В базе могут остаться события с теми же координатами; выбираем нужное из списка, а не перекрытый маркер.
  await page
    .getByRole("region", { name: "Мероприятия в этой области" })
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "Показать на карте", exact: true })
    .click();
  await page
    .getByRole("complementary", { name: "Выбранный объект" })
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

test("Java map: returning after join refreshes counts and moderation removes the selected event", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  await signInAs(page, "athlete-a");
  const event = await setupMapEvent(
    page,
    `Карта и модерация Java ${Date.now()}`,
    new Date(Date.now() + 7 * 86400000).toISOString(),
  );
  const context = await browser.newContext({
    viewport: { width: 375, height: 1000 },
    serviceWorkers: "block",
    baseURL: "http://127.0.0.1:5174",
    storageState: familiarVisitorState,
  });
  try {
    const viewer = await context.newPage();
    await viewer
      .context()
      .route("https://tiles.openfreemap.org/**", (route) => route.abort());
    await signInAs(viewer, "athlete-b");
    await viewer.goto(
      `/map?lat=53.19556&lng=50.10102&zoom=17&eventId=${event.id}&venues=off`,
    );
    const selected = viewer.getByRole("complementary", {
      name: "Выбранный объект",
    });
    await expect(selected).toContainText(event.title);
    await expect(selected).toContainText("0 из 10 участников");
    await selected
      .getByRole("link", { name: "Подробнее", exact: true })
      .click();
    await viewer
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(
      viewer.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await viewer
      .getByRole("link", { name: "Назад к карте", exact: true })
      .click();
    await expect(selected).toContainText("1 из 10 участников");
    await signInAs(page, "admin");
    const row = await findModerationEvent(page, event.title);
    await row
      .getByRole("button", { name: "Снять с публикации", exact: true })
      .click();
    await page
      .getByLabel("Причина модерации", { exact: true })
      .fill("Место встречи требует уточнения.");
    await page
      .getByRole("button", {
        name: "Подтвердить: снять с публикации",
        exact: true,
      })
      .click();
    await expect(selected).toContainText("Объект не найден", {
      timeout: 15000,
    });
    await expect(
      viewer.getByTitle(`Мероприятие: ${event.title}`, { exact: true }),
    ).toHaveCount(0);
    expect(
      await viewer.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await viewer.screenshot({
      path: "test-results/java-map-moderation.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
