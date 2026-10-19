import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T00:00:00Z"));
});

test("catalog, URL filters, detail and not-found", async ({ page }) => {
  await page.goto("/?includePast=true");
  await expect(
    page.getByRole("heading", { name: /Утро. Парк. Лёгкий бег/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Теннис", exact: true }).click();
  await expect(page).toHaveURL(/sportId=tennis/);
  await page.reload();
  await page
    .getByRole("heading", { name: "Теннис без спешки" })
    .getByRole("link")
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Теннис без спешки",
  );
  await expect(page.getByText(/Местное время события/)).toBeVisible();
  await page.goto("/events/missing");
  await expect(
    page.getByRole("heading", { name: /сбились с маршрута/ }),
  ).toBeVisible();
});

test("demo session restores and account switch removes privileges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Администратор", { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page.getByRole("link", { name: "Модерация" })).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Модерация" }).click();
  await expect(
    page.getByRole("heading", { name: "Кабинет администратора" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/login");
  await page.getByLabel("Александр", { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page.getByRole("link", { name: "Модерация" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Нет доступа" }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Беговой клуб", { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await page.getByRole("link", { name: "Организация", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Кабинет организации" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("keyboard navigation and required account selection", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Демо-вход" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Перейти к содержимому" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page.getByRole("alert")).toHaveText("Выберите демо-аккаунт");
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?includePast=true");
    await expect(
      page.getByRole("heading", { name: /Утро. Парк. Лёгкий бег/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/catalog-${width}.png`,
      fullPage: true,
    });
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Демо-вход" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
