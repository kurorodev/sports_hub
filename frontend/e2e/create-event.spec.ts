import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-19T00:00:00Z"));
});

async function signIn(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel(name, { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/");
}

async function fillEvent(page: Page, title: string, sport: string) {
  await page.getByLabel("Название встречи", { exact: true }).fill(title);
  await page.getByLabel("Вид спорта", { exact: true }).click();
  await page.getByRole("option", { name: "Другое", exact: true }).click();
  await page.getByLabel("Название активности", { exact: true }).fill(sport);
  await page
    .getByLabel("О встрече", { exact: true })
    .fill(
      "Знакомимся со спортом, объясняем правила и играем вместе. Всё необходимое принесёт организатор.",
    );
  await page.getByLabel("Город", { exact: true }).fill("Красноярск");
  await page
    .getByLabel("Место встречи", { exact: true })
    .fill("Остров Татышев, главный вход");
  await page.getByLabel("Дата", { exact: true }).press("Enter");
  const calendar = page.getByRole("dialog", {
    name: "Выбор даты",
    exact: true,
  });
  await calendar.getByRole("button", { name: "Следующий месяц" }).click();
  await calendar.locator('[data-date="2026-11-07"]').click();
  await page.getByLabel("Время", { exact: true }).fill("18:30");
  await page.getByLabel("Часовой пояс места встречи", { exact: true }).click();
  await page
    .getByRole("option", { name: "UTC+07:00 · Красноярск", exact: true })
    .click();
}

for (const width of [375, 768, 1440]) {
  test(`S1 new sport persists and another user finds it at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, "Александр");
    await page.getByRole("link", { name: "Создать", exact: true }).click();
    const title = `Петанк на острове ${width}`;
    const sport = `Петанк ${width}`;
    await fillEvent(page, title, sport);
    const posted = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/events") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Опубликовать встречу" }).click();
    expect((await posted).status()).toBe(201);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(
      page.getByText("Мероприятие создано", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Вы организатор", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("time")).toContainText("18:30");
    const detailUrl = page.url();
    await expect(
      page.getByRole("link", { name: "Открыть мероприятие", exact: true }),
    ).toHaveCount(0);
    const toast = page
      .getByRole("status")
      .filter({ hasText: "Мероприятие создано" });
    await expect(toast).toHaveClass(/toast-top/);
    await expect(toast).toHaveClass(/toast-success/);
    await expect(toast).toHaveCount(0, { timeout: 6000 });
    await expect(page).toHaveURL(detailUrl);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await signIn(page, "Мария");
    await page.getByRole("button", { name: "Другое", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.getByRole("heading", { name: title }).getByRole("link").click();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByText("Вы организатор", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Мероприятие создано", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/created-event-${width}.png`,
      fullPage: true,
    });
  });
}

test("guest returns to creation after demo login and past dates cannot be selected", async ({
  page,
}) => {
  await page.goto("/events/new");
  await page.getByRole("link", { name: "Войти и создать" }).click();
  await page.getByLabel("Александр", { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/events/new");
  await fillEvent(page, "Встреча в прошлом", "Петанк");
  await page.getByLabel("Дата", { exact: true }).click();
  const calendar = page.getByRole("dialog", {
    name: "Выбор даты",
    exact: true,
  });
  await calendar.getByRole("button", { name: "Предыдущий месяц" }).click();
  await expect(calendar.locator('[data-date="2026-10-18"]')).toBeDisabled();
  await expect(calendar.locator('[data-date="2026-10-19"]')).toBeEnabled();
  await expect(page).toHaveURL("/events/new");
  await expect(page.getByLabel("Название встречи")).toHaveValue(
    "Встреча в прошлом",
  );
});

test("creation calendar follows the event timezone across midnight", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-18T21:30:00Z"));
  await signIn(page, "Александр");
  await page.goto("/events/new");
  const date = page.getByLabel("Дата", { exact: true });
  const timezone = page.getByLabel("Часовой пояс места встречи", {
    exact: true,
  });
  await date.click();
  await expect(page.locator('[data-date="2026-10-18"]')).toBeDisabled();
  await timezone.click();
  await page.getByRole("option", { name: "UTC+02:00", exact: true }).click();
  await date.click();
  await expect(page.locator('[data-date="2026-10-18"]')).toBeEnabled();
  await timezone.click();
  await page
    .getByRole("option", { name: "UTC+07:00 · Красноярск", exact: true })
    .click();
  await date.click();
  await expect(page.locator('[data-date="2026-10-18"]')).toBeDisabled();
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`create form fits ${width}px including long text and field errors`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, "Александр");
    await page.goto("/events/new");
    await page.getByRole("button", { name: "Опубликовать встречу" }).click();
    await expect(page.getByText("Название — от 3 символов")).toBeVisible();
    await fillEvent(
      page,
      "Длинное название спортивной встречи для проверки адаптива и переноса текста на небольших мобильных экранах",
      "Новая необычная спортивная дисциплина для всех желающих",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/create-form-${width}.png`,
      fullPage: true,
    });
  });
}
