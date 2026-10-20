import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/approval";

for (const width of [375, 1440]) {
  test(`admin categories, photos, read-only browsing and aligned filters at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "admin");
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Создать", exact: true }),
    ).toHaveCount(0);
    await page.goto("/admin?section=sports");
    const name = `Падел QA ${width} ${Date.now()}`;
    await page.getByLabel("Название вида спорта", { exact: true }).fill(name);
    await page.getByLabel("Фото категории", { exact: true }).setInputFiles({
      name: "sport.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNQmBAARAwQCgAbTgQBKKQQpAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await expect(
      page.getByAltText("Предпросмотр фото категории"),
    ).toBeVisible();
    const posted = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/admin/sports") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Создать категорию", exact: true })
      .click();
    const response = await posted;
    expect(response.status()).toBe(201);
    const sport = (await response.json()) as { id: string; imageUrl: string };
    await expect(
      page.getByText("Категория создана", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByLabel("Поиск вида спорта", { exact: true }).fill(name);
    const card = page
      .locator(".admin-sport-list > li")
      .filter({
        has: page.getByRole("button", {
          name: `Редактировать: ${name}`,
          exact: true,
        }),
      });
    await expect(card).toHaveCount(1);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("img")).toHaveJSProperty("naturalWidth", 2);
    await page.screenshot({
      path: `test-results/admin-sports-${width}.png`,
      fullPage: true,
    });
    await card.getByRole("button").click();
    const editor = page.getByRole("dialog", { name: "Настройки категории" });
    const renamed = `${name} новое`;
    await editor
      .getByLabel("Название категории", { exact: true })
      .fill(renamed);
    await editor
      .getByLabel("Заменить фото категории", { exact: true })
      .setInputFiles({
        name: "replacement.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNQmBAARAwQCgAbTgQBKKQQpAAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    await page.screenshot({
      path: `test-results/sport-editor-${width}.png`,
      fullPage: true,
    });
    expect(
      await editor.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    const updated = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/admin/sports/${sport.id}`) &&
        r.request().method() === "PATCH",
    );
    await editor
      .getByRole("button", { name: "Сохранить изменения", exact: true })
      .click();
    const patchResponse = await updated;
    expect(patchResponse.status()).toBe(200);
    sport.imageUrl = (await patchResponse.json()).imageUrl;
    await expect(editor).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: `Редактировать: ${renamed}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await page.getByLabel("Поиск вида спорта", { exact: true }).fill(renamed);
    await page
      .getByRole("button", { name: `Редактировать: ${renamed}`, exact: true })
      .click();
    await editor
      .getByLabel("Название категории", { exact: true })
      .fill("Не сохранять");
    await editor.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: `Редактировать: ${renamed}`,
        exact: true,
      }),
    ).toBeFocused();
    await page.goto("/profile?edit=1");
    await expect(
      page.getByRole("heading", { name: "Редактировать профиль", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Спортивные роли", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Любимые виды спорта", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Когда удобно заниматься", { exact: true }),
    ).toHaveCount(0);
    await page.goto("/profile");
    await expect(page.locator(".profile-rating")).toHaveCount(0);
    await signInAs(page, "coach");
    const title = `Категория QA ${width} ${Date.now()}`;
    const eventId = await page.evaluate(
      async ({ sportId, title }) => {
        const session = await (await fetch("/api/v1/session")).json();
        const response = await fetch("/api/v1/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({
            title,
            description: "Спортивная встреча с новой категорией и её фото",
            sport: { sportId },
            startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            location: { city: "Самара", address: "Главный вход в парк" },
            joinMode: "OPEN",
            organizer: { type: "USER", id: session.user.id },
            publishNow: true,
            maxParticipants: 10,
          }),
        });
        if (response.status !== 201)
          throw new Error(`Create event failed: ${response.status}`);
        return (await response.json()).id as string;
      },
      { sportId: sport.id, title },
    );
    await page.goto(`/?q=${encodeURIComponent(title)}`);
    const eventCard = page.locator(".event-card").filter({ hasText: title });
    await expect(eventCard.locator("img").first()).toHaveAttribute(
      "src",
      sport.imageUrl,
    );
    await signInAs(page, "admin");
    await page.goto(`/events/${eventId}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Присоединиться", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Ваше сообщение", exact: true }),
    ).toHaveCount(0);
    await page.goto("/admin?section=sports");
    await page.getByLabel("Поиск вида спорта", { exact: true }).fill(renamed);
    await page
      .getByRole("button", { name: `Редактировать: ${renamed}`, exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Удалить категорию", exact: true })
      .click();
    await expect(
      editor.getByRole("group", { name: "Подтверждение удаления категории" }),
    ).toBeVisible();
    await editor
      .getByRole("button", { name: "Подтвердить удаление", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(
      page.getByText("Категория удалена", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Редактировать: ${renamed}`,
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto(`/events/${eventId}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.goto("/events/new");
    await expect(
      page.getByRole("button", { name: "Опубликовать встречу", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "К инструментам администратора" }),
    ).toBeVisible();
    await page.goto("/admin?section=events");
    const search = page.getByLabel("Название или описание мероприятия", {
      exact: true,
    });
    await search.fill(title);
    await page
      .getByRole("button", { name: "Применить фильтры", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: `Мероприятие: ${title}`, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".moderation-list > article")).toHaveCount(1);
    await page.getByLabel("Статус мероприятий", { exact: true }).click();
    await page
      .getByRole("option", { name: "Снятые с публикации", exact: true })
      .click();
    await expect(page.locator(".moderation-list > article")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Применить фильтры", exact: true })
      .click();
    await expect(
      page.getByText("Найдено мероприятий: 0", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Сбросить фильтры", exact: true })
      .click();
    await expect(
      page.locator(".moderation-list > article").first(),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/admin-events-${width}.png`,
      fullPage: true,
    });
    await page.goto("/admin");
    await page
      .getByLabel("Название или описание организации", { exact: true })
      .fill("Вектор");
    await page.getByLabel("Статус организаций", { exact: true }).click();
    await page
      .getByRole("option", { name: "Все статусы", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Применить фильтры", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: "Организация: Вектор", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
