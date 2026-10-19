import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page, accountId: string) {
  await page.goto("/login");
  await page.locator(`input[value="${accountId}"]`).check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/");
}
for (const width of [375, 768, 1440]) {
  test(`Java S1/S3: cookie, custom sport, participant persistence, capacity at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    expect((await page.request.get("/api/v1/health")).ok()).toBe(true);
    await signIn(page, "athlete-a");
    const ownerSession = await (
      await page.request.get("/api/v1/session")
    ).json();
    const sportsBefore = await (
      await page.request.get("/api/v1/sports")
    ).json();
    expect(sportsBefore).toHaveLength(201);
    const cookie = (await context.cookies()).find(
      (item) => item.name === "SPORT_SESSION",
    );
    expect(cookie?.httpOnly).toBe(true);
    const suffix = `${width}-${Date.now()}`;
    const title = `Пробежка Java ${suffix}`;
    const sport = `Командный бег ${suffix}`;
    const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await page.goto("/events/new");
    await page.getByLabel("Название встречи", { exact: true }).fill(title);
    await page
      .getByLabel("Вид спорта", { exact: true })
      .selectOption("__custom__");
    await page.getByLabel("Название активности", { exact: true }).fill(sport);
    await page
      .getByLabel("О встрече", { exact: true })
      .fill("Встречаемся у входа в парк и вместе бежим в спокойном темпе.");
    await page.getByLabel("Город", { exact: true }).fill("Красноярск");
    await page
      .getByLabel("Место встречи", { exact: true })
      .fill("Парк, главный вход");
    await page.getByLabel("Дата", { exact: true }).fill(date);
    await page.getByLabel("Время", { exact: true }).fill("18:30");
    await page
      .getByLabel("Часовой пояс места встречи", { exact: true })
      .selectOption("+07:00");
    await page.getByLabel("Количество мест", { exact: true }).fill("2");
    const createdResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/v1/events"),
    );
    await page.getByRole("button", { name: "Опубликовать встречу" }).click();
    const created = await createdResponse;
    expect(created.status()).toBe(201);
    expect(created.fromServiceWorker()).toBe(false);
    const event = await created.json();
    expect(event.sport.name).toBe("Другое");
    expect(event.customSportName).toBe(sport);
    expect(await (await page.request.get("/api/v1/sports")).json()).toEqual(
      sportsBefore,
    );
    expect(event.organizer.id).toBe(ownerSession.user.id);
    expect(Date.parse(event.startsAt)).toBe(
      Date.parse(`${date}T18:30:00+07:00`),
    );
    await expect(page.getByText("Встреча опубликована")).toBeVisible();
    await expect(
      page.getByText("Часовой пояс: UTC", { exact: true }),
    ).toBeVisible();
    const url = page.url();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await signIn(page, "athlete-b");
    await page.goto(`/?q=${encodeURIComponent(title)}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("heading", { name: title, exact: true })
      .getByRole("link")
      .click();
    expect(
      (
        await page.request.get(`/api/v1/events/${event.id}/my-registration`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(`/api/v1/events/${event.id}/registrations`, {
          data: {},
        })
      ).status(),
    ).toBe(403);
    const registrationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/registrations"),
    );
    await page
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    const registered = await registrationResponse;
    expect(registered.status()).toBe(201);
    expect(registered.fromServiceWorker()).toBe(false);
    expect(await registered.json()).toMatchObject({
      status: "CONFIRMED",
      eventId: event.id,
    });
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("1 из 2 участников", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Вы участвуете", { exact: true }),
    ).toBeVisible();
    const participantSession = await (
      await page.request.get("/api/v1/session")
    ).json();
    expect(
      (
        await page.request.post(`/api/v1/events/${event.id}/registrations`, {
          data: {},
          headers: { "X-CSRF-Token": participantSession.csrfToken },
        })
      ).status(),
    ).toBe(409);
    await signIn(page, "athlete-a");
    await page.goto(url);
    await expect(
      page
        .getByRole("list", { name: "Кто идёт" })
        .getByText("Мария Беговая", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Вы организатор", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Присоединиться", exact: true }),
    ).toHaveCount(0);
    await signIn(page, "athlete-c");
    await page.goto(url);
    await page
      .getByRole("button", { name: "Присоединиться", exact: true })
      .click();
    await expect(
      page.getByText("2 из 2 участников", { exact: true }),
    ).toBeVisible();
    await signIn(page, "org-approved");
    await page.goto(url);
    await expect(
      page.getByText("Все места заняты. Выберите другую встречу.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/java-${width}.png`,
      fullPage: true,
    });
    await page.goto("/events/not-a-uuid");
    await expect(
      page.getByRole("heading", { name: /сбились с маршрута/ }),
    ).toBeVisible();
    await signIn(page, "admin");
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Кабинет администратора" }),
    ).toBeVisible();
    await signIn(page, "athlete-a");
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Нет доступа" }),
    ).toBeVisible();
  });
}
