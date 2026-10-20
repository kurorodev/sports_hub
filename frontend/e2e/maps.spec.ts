import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  // Browser checks exercise our map and markers without depending on a public tile server.
  await page
    .context()
    .route("https://tiles.openfreemap.org/**", (route) => route.abort());
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Александр", { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/");
}
async function selectLocation(page: Page) {
  await page.getByLabel("Город", { exact: true }).fill("Самара");
  await page
    .getByRole("combobox", { name: /Место встречи|Адрес площадки/ })
    .fill("площадь Куйбышева");
  await page.getByRole("option", { name: "Самара, площадь Куйбышева" }).click();
  await expect(page.getByText(/Точка: 53.19556, 50.10102/)).toBeVisible();
}

for (const width of [375, 1440]) {
  test(`event pin persists, tooltip and popup lead to the same event at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.goto("/events/new");
    const title = `Встреча на карте ${width}`;
    await page.getByLabel("Название встречи", { exact: true }).fill(title);
    await page.getByLabel("Вид спорта", { exact: true }).click();
    await page.getByRole("option", { name: "Баскетбол", exact: true }).click();
    await page
      .getByLabel("О встрече", { exact: true })
      .fill("Собираемся вместе, знакомимся и играем в баскетбол.");
    await selectLocation(page);
    // Picking a point invokes reverse geocoding; the selected coordinates survive POST and GET.
    await page.locator(".location-picker .map-canvas").click();
    await expect(
      page.getByRole("combobox", { name: "Место встречи" }),
    ).toHaveValue("площадь Куйбышева");
    await page.getByLabel("Дата", { exact: true }).fill("2026-11-10");
    await page.getByLabel("Время", { exact: true }).fill("18:00");
    const posted = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/events") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Опубликовать встречу" }).click();
    const response = await posted;
    expect(response.status()).toBe(201);
    const payload = response.request().postDataJSON();
    expect(typeof payload.location.latitude).toBe("number");
    expect(typeof payload.location.longitude).toBe("number");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    const detailUrl = page.url();
    await page.getByRole("link", { name: "Карта", exact: true }).click();
    // Demo venues share this reference point; layers keep overlapping objects accessible.
    await page.getByLabel("Площадки", { exact: true }).uncheck();
    const marker = page.getByTitle(`Мероприятие: ${title}`, { exact: true });
    await expect(marker).toBeVisible();
    await marker.focus();
    await expect(page.locator(".map-marker-tooltip")).toContainText(title);
    await marker.click();
    await expect(page.locator(".maplibregl-popup")).toContainText(title);
    await page
      .locator(".maplibregl-popup")
      .getByRole("link", { name: "Подробнее" })
      .click();
    await expect(page).toHaveURL(detailUrl);
  });
}

test("create venue, save occupancy, retain selection on cooldown and toggle independent layers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await login(page);
  await page.goto("/map");
  await page
    .getByRole("button", { name: "Добавить площадку", exact: true })
    .click();
  await page
    .getByLabel("Название площадки", { exact: true })
    .fill("Новая площадка для игры");
  await selectLocation(page);
  await page.getByRole("button", { name: "Сохранить площадку" }).click();
  await expect(page.getByText(/Площадка добавлена/)).toBeVisible();
  const card = page
    .getByRole("region", { name: "Площадки в этой области" })
    .getByRole("article")
    .filter({ hasText: "Новая площадка для игры" });
  await expect(card).toContainText("Нет актуальных данных");
  await card.getByRole("button", { name: "Оценить загруженность" }).click();
  await page.getByLabel("Свободно / мало людей", { exact: true }).check();
  await page.getByLabel(/Сколько людей/).fill("5");
  const posted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/reports") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Отправить оценку" }).click();
  expect((await posted).status()).toBe(201);
  await expect(
    page.getByText("Оценка загруженности сохранена", { exact: true }),
  ).toBeVisible();
  await expect(card).toContainText("Свободно / мало людей");
  await card.getByRole("button", { name: "Оценить загруженность" }).click();
  await page.getByLabel("Много людей", { exact: true }).check();
  await page.getByRole("button", { name: "Отправить оценку" }).click();
  await expect(page.getByRole("alert")).toContainText("10 минут");
  await expect(page.getByLabel("Много людей", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Закрыть форму" }).click();
  await page.getByLabel("Мероприятия", { exact: true }).uncheck();
  await expect(card).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Мероприятия в этой области" }),
  ).toHaveCount(0);
  await page.getByLabel("Площадки", { exact: true }).uncheck();
  await page.getByLabel("Мероприятия", { exact: true }).check();
  await expect(
    page.getByRole("region", { name: "Площадки в этой области" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`guest map is accessible at ${width}px and returns from login`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/map");
    await expect(
      page
        .getByRole("region", { name: "Площадки в этой области" })
        .getByRole("article")
        .first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/map-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Оценить загруженность" })
      .first()
      .click();
    await page.getByRole("link", { name: "Войти и вернуться к карте" }).click();
    await page.getByLabel("Александр", { exact: false }).check();
    await page.getByRole("button", { name: "Войти в аккаунт" }).click();
    await expect(page).toHaveURL("/map");
  });
}

test("panning and zoom keep viewport, list filters and layers after reload", async ({
  page,
}) => {
  await page.goto(
    "/map?lat=53.19556&lng=50.10102&zoom=17&venues=off&city=Самара",
  );
  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/Подложка карты недоступна/)).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 40,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("lng"))
    .not.toBe("50.10102");
  await page.getByRole("button", { name: "Приблизить", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("zoom"))
    .toBe("18");
  const params = new URL(page.url()).searchParams;
  expect(params.get("venues")).toBe("off");
  expect(params.get("city")).toBe("Самара");
  const url = page.url();
  await page.reload();
  await expect(canvas).toBeVisible();
  await expect(page).toHaveURL(url);
  await expect(page.getByLabel("Площадки", { exact: true })).not.toBeChecked();
});

test("selected point moves with keyboard and keeps actual coordinates through reverse geocoding", async ({
  page,
}) => {
  await login(page);
  await page.goto("/events/new");
  await selectLocation(page);
  const pin = page.getByTitle("Выбранная точка", { exact: true });
  await pin.focus();
  const reversed = page.waitForResponse((response) =>
    response.url().includes("/api/v1/geo/reverse?"),
  );
  await pin.press("Shift+ArrowRight");
  const url = new URL((await reversed).url());
  expect(Number(url.searchParams.get("longitude"))).toBeGreaterThan(50.101022);
  expect(Number(url.searchParams.get("latitude"))).toBeCloseTo(53.195561, 5);
  await expect(
    page.getByText("Адрес точки найден", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Точка:/)).not.toContainText("50.10102");
});
