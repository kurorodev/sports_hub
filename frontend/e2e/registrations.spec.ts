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

async function createOpenEvent(page: Page, title: string) {
  await page.goto("/events/new");
  await page.getByLabel("Название встречи", { exact: true }).fill(title);
  await page
    .getByLabel("Вид спорта", { exact: true })
    .selectOption("147eb74c-0000-4000-8000-000000000000");
  await page
    .getByLabel("О встрече", { exact: true })
    .fill("Вместе бежим в спокойном темпе, после можно выпить кофе.");
  await page.getByLabel("Город", { exact: true }).fill("Москва");
  await page
    .getByLabel("Место встречи", { exact: true })
    .fill("Парк, главный вход");
  await page.getByLabel("Дата", { exact: true }).fill("2026-11-07");
  await page.getByLabel("Время", { exact: true }).fill("18:00");
  await page.getByLabel("Количество мест", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Опубликовать встречу" }).click();
  await expect(page.getByText("Встреча опубликована")).toBeVisible();
  await expect(page.getByText("Пока никто не записался.")).toBeVisible();
  return page.url();
}

for (const width of [375, 768, 1440]) {
  test(`S3 OPEN persists, prevents duplicate UI and appears for organizer at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, "Александр");
    const title = `Вместе на пробежку ${width}`;
    const url = await createOpenEvent(page, title);
    await signIn(page, "Мария");
    await page.goto(url);
    const button = page.getByRole("button", {
      name: "Присоединиться",
      exact: true,
    });
    await expect(button).toBeVisible();
    if (width === 375) {
      const bounds = await button.boundingBox();
      expect(bounds && bounds.y + bounds.height <= 1000).toBeTruthy();
    }
    let postCount = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/registrations")
      )
        postCount += 1;
    });
    const response = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/registrations"),
    );
    await button.focus();
    await page.keyboard.press("Enter");
    const joined = await response;
    expect(joined.status()).toBe(201);
    expect(await joined.json()).toMatchObject({
      status: "CONFIRMED",
      user: { displayName: "Мария" },
    });
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 из 2 участников", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "Кто идёт" })
        .getByText("Мария", { exact: true }),
    ).toBeVisible();
    await expect(button).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await expect(button).toHaveCount(0);
    expect(postCount).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/participation-${width}.png`,
      fullPage: true,
    });
    await page.goto(`/?q=${encodeURIComponent(title)}`);
    await expect(
      page
        .getByRole("article")
        .filter({ has: page.getByRole("heading", { name: title }) })
        .getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await signIn(page, "Александр");
    await page.goto(url);
    await expect(
      page.getByText("Вы организатор", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 из 2 участников", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "Кто идёт" })
        .getByText("Мария", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Присоединиться" }),
    ).toHaveCount(0);
    await expect(page.getByText("Вы участвуете", { exact: true })).toHaveCount(
      0,
    );
    await signIn(page, "Администратор");
    await page.goto(url);
    await page.getByRole("button", { name: "Присоединиться" }).click();
    await expect(
      page.getByText("2 из 2 участников", { exact: true }),
    ).toBeVisible();
    await signIn(page, "Беговой клуб");
    await page.goto(url);
    await expect(
      page.getByText("Все места заняты. Выберите другую встречу.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Присоединиться" }),
    ).toHaveCount(0);
  });
}

test("guest login returns to event and APPROVAL is not treated as OPEN", async ({
  page,
}) => {
  await page.goto("/events/82e2dd5f-0000-4000-8000-000000000000");
  await page.getByRole("link", { name: "Войти для записи" }).click();
  await page.getByLabel("Мария", { exact: false }).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/events/82e2dd5f-0000-4000-8000-000000000000");
  await page.getByRole("button", { name: "Присоединиться" }).click();
  await expect(page.getByText("Вы участвуете", { exact: true })).toBeVisible();
  await page.goto("/events/6d69380d-0000-4000-8000-000000000000");
  await expect(
    page.getByRole("button", { name: "Подать заявку", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Присоединиться" }),
  ).toHaveCount(0);
});

for (const width of [320, 1024]) {
  test(`participant list and join action fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signIn(page, "Мария");
    await page.goto("/events/82e2dd5f-0000-4000-8000-000000000000");
    await expect(
      page.getByRole("button", { name: "Присоединиться" }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Кто идёт" }).getByRole("listitem"),
    ).toHaveCount(8);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/participation-${width}.png`,
      fullPage: true,
    });
  });
}
