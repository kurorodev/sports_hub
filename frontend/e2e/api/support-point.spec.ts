import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/approval";
test("Java support: venue pin persists and admin publishes an already closed suggestion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page
    .context()
    .route("https://tiles.openfreemap.org/**", (route) => route.abort());
  await signInAs(page, "athlete-c");
  await page.goto("/support/new?category=VENUE_SUGGESTION");
  await page
    .getByLabel("Название площадки", { exact: true })
    .fill(`Площадка с точкой ${Date.now()}`);
  await page.getByLabel("Город площадки", { exact: true }).fill("Самара");
  await page
    .getByRole("combobox", { name: "Адрес площадки", exact: true })
    .fill("Парк, спортивная площадка");
  await page
    .getByRole("button", { name: "Указать на карте", exact: true })
    .click();
  await page.locator(".location-picker .map-canvas").click();
  await expect(
    page.getByText(
      /Поиск адресов недоступен. Заполните город|Адрес не найден. Заполните город/,
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Город площадки", { exact: true })).toHaveValue(
    "Самара",
  );
  await expect(
    page.getByRole("combobox", { name: "Адрес площадки", exact: true }),
  ).toHaveValue("Парк, спортивная площадка");
  const text = await page.getByText(/^Точка: /).textContent();
  const match = text!.match(/Точка: ([-\d.]+), ([-\d.]+)/)!;
  await page.getByLabel("Город площадки", { exact: true }).fill("Самара");
  await page
    .getByRole("combobox", { name: "Адрес площадки", exact: true })
    .fill("Парк, спортивная площадка");
  await page
    .getByRole("button", { name: "Подтвердить адрес точки", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: /Подробности/ })
    .fill("Предлагаю добавить площадку, точное место отмечено на карте.");
  const posted = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/support/tickets") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Отправить обращение", exact: true })
    .click();
  const response = await posted;
  expect(response.status()).toBe(201);
  const ticket = await response.json();
  expect(ticket.venueLatitude).toBeCloseTo(Number(match[1]), 4);
  expect(ticket.venueLongitude).toBeCloseTo(Number(match[2]), 4);
  expect(ticket.venueCity).toBe("Самара");
  await expect(page).toHaveURL(`/support/${ticket.id}`);
  await page.reload();
  await expect(page.getByText(text!, { exact: true })).toBeVisible();
  await signInAs(page, "admin");
  await page.goto(`/support/${ticket.id}`);
  await page
    .getByRole("button", { name: "Показать площадку на карте", exact: true })
    .click();
  await expect(
    page.locator(".support-quote .map-canvas").first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("combobox", { name: "Изменить статус", exact: true })
    .selectOption("CLOSED");
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Открыть повторно", exact: true }),
  ).toBeVisible();
  const published = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/support/tickets/${ticket.id}/venue`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", {
      name: "Добавить площадку и решить обращение",
      exact: true,
    })
    .click();
  const approval = await published;
  expect(approval.status()).toBe(200);
  const resolved = await approval.json();
  expect(resolved.status).toBe("RESOLVED");
  expect(resolved.publishedVenueId).toBeTruthy();
  await page
    .getByRole("link", { name: "Открыть добавленную площадку", exact: true })
    .click();
  await expect(
    page
      .getByRole("complementary", { name: "Выбранный объект" })
      .getByRole("heading", { name: ticket.title }),
  ).toBeVisible();
  await signInAs(page, "athlete-c");
  await page.goto(`/support/${ticket.id}`);
  await expect(
    page.getByRole("link", {
      name: "Открыть добавленную площадку",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Площадка добавлена в список доступных площадок.", {
      exact: true,
    }),
  ).toBeVisible();
});
