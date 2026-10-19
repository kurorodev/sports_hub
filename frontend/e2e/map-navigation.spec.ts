import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";
import { setupMapEvent } from "./helpers/maps";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await page
    .context()
    .route("https://tiles.openfreemap.org/**", (route) => route.abort());
});
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`catalog filters, selected object, location and return survive at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-alex");
    const event = await setupMapEvent(
      page,
      `Переходы по карте ${width}`,
      "2026-11-10T15:00:00Z",
    );
    const filters = new URLSearchParams({
      q: event.title,
      sportId: event.sport.id,
      city: "Самара",
      from: "2026-11-01",
      to: "2026-11-30",
      joinMode: "OPEN",
      hasSpots: "true",
    });
    await page.goto(`/?${filters}`);
    await expect(
      page.getByRole("heading", { name: event.title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Вид активностей" })
      .getByRole("link", { name: "На карте", exact: true })
      .click();
    await expect(
      page.getByText(/Только в списке: поиск по тексту, город/),
    ).toBeVisible();
    await expect(page.getByLabel("Вид спорта на карте")).toHaveValue(
      event.sport.id,
    );
    await expect(page.getByLabel("Дата от (UTC)")).toHaveValue("2026-11-01");
    const card = page
      .getByRole("region", { name: "Мероприятия в этой области" })
      .getByRole("article")
      .filter({ hasText: event.title });
    await card
      .getByRole("button", { name: "Показать на карте", exact: true })
      .click();
    const selection = page.getByRole("complementary", {
      name: "Выбранный объект",
    });
    await expect(selection).toContainText(event.title);
    await expect(selection).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`eventId=${event.id}`));
    await selection
      .getByRole("link", { name: "Подробнее", exact: true })
      .click();
    await expect(page).toHaveURL(`/events/${event.id}`);
    const back = page.getByRole("link", { name: "Назад к карте", exact: true });
    const mapReturn = await back.getAttribute("href");
    const place = page.getByRole("region", {
      name: "Место встречи",
      exact: true,
    });
    await place
      .getByRole("button", { name: "Показать место на карте" })
      .click();
    await expect(place.getByTitle("Выбранная точка")).toBeVisible();
    await expect(place.getByText(/Подложка недоступна/)).toBeVisible();
    await page.reload();
    await expect(back).toHaveAttribute("href", mapReturn!);
    await back.click();
    await expect(selection).toContainText(event.title);
    await expect(page.getByLabel("Дата до (UTC)")).toHaveValue("2026-11-30");
    await page.screenshot({
      path: `test-results/map-navigation-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await selection.getByRole("button", { name: "Закрыть карточку" }).click();
    await page
      .getByRole("navigation", { name: "Вид активностей" })
      .getByRole("link", { name: "Список", exact: true })
      .click();
    const listUrl = new URL(page.url());
    for (const [key, value] of filters)
      expect(listUrl.searchParams.get(key)).toBe(value);
    expect(listUrl.searchParams.has("lat")).toBe(false);
    expect(listUrl.searchParams.has("eventId")).toBe(false);
    await expect(
      page.getByRole("heading", { name: event.title, exact: true }),
    ).toBeVisible();
  });
}

test("map login preserves viewport and invalid coordinates fall back safely", async ({
  page,
}) => {
  const query = "lat=53.19556&lng=50.10102&zoom=16&venues=off";
  await page.goto(`/map?${query}`);
  await page
    .getByRole("button", { name: "Добавить площадку", exact: true })
    .click();
  await page.getByRole("link", { name: "Войти и вернуться к карте" }).click();
  await page.locator('input[value="user-maria"]').check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL(`/map?${query}`);
  await expect(page.getByLabel("Площадки", { exact: true })).not.toBeChecked();
  await page.goto("/map?lat=Infinity&lng=-190&zoom=99&events=off&venues=off");
  await expect(page.getByText(/Оба слоя выключены/)).toBeVisible();
  await page.getByLabel("Площадки", { exact: true }).check();
  await expect(
    page
      .getByRole("region", { name: "Площадки в этой области" })
      .getByRole("article")
      .first(),
  ).toBeVisible();
});
