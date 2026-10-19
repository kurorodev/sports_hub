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
  await page
    .getByLabel("Вид спорта", { exact: true })
    .selectOption("__custom__");
  await page
    .getByLabel("Название нового вида спорта", { exact: true })
    .fill(sport);
  await page
    .getByLabel("О встрече", { exact: true })
    .fill(
      "Знакомимся со спортом, объясняем правила и играем вместе. Всё необходимое принесёт организатор.",
    );
  await page.getByLabel("Город", { exact: true }).fill("Красноярск");
  await page
    .getByLabel("Место встречи", { exact: true })
    .fill("Остров Татышев, главный вход");
  await page.getByLabel("Дата", { exact: true }).fill("2026-11-07");
  await page.getByLabel("Время", { exact: true }).fill("18:30");
  await page
    .getByLabel("Часовой пояс места встречи", { exact: true })
    .selectOption("+07:00");
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
    await expect(page.getByText("Встреча опубликована")).toBeVisible();
    await expect(page.getByText("Вы организатор")).toBeVisible();
    await expect(page.locator("time")).toContainText("18:30");
    const detailUrl = page.url();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await signIn(page, "Мария");
    await page.getByRole("button", { name: sport, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.getByRole("heading", { name: title }).getByRole("link").click();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByText("Вы организатор")).toHaveCount(0);
    await expect(page.getByText("Встреча опубликована")).toHaveCount(0);
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

test("guest returns to creation after demo login and invalid date stays in form", async ({
  page,
}) => {
  await page.goto("/events/new");
  await page.getByRole("link", { name: "Войти и создать" }).click();
  await page.getByLabel("Александр", { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/events/new");
  await fillEvent(page, "Встреча в прошлом", "Петанк");
  await page.getByLabel("Дата", { exact: true }).fill("2026-10-18");
  await page.getByRole("button", { name: "Опубликовать встречу" }).click();
  await expect(page.getByText("Выберите будущую дату и время")).toBeVisible();
  await expect(page).toHaveURL("/events/new");
  await expect(page.getByLabel("Название встречи")).toHaveValue(
    "Встреча в прошлом",
  );
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
