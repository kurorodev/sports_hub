import { familiarVisitorState } from "./helpers/site-onboarding";
import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

// Системный буфер обмена общий; параллельные проверки копирования мешали бы друг другу.
test.describe.configure({ mode: "serial" });
for (const width of [320, 375, 768, 1440]) {
  test(`organizer hover, copy and paste into discussion at ${width}px`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-maria");
    const event = page
      .locator(".event-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Собираемся на баскет",
          exact: true,
        }),
      });
    const name = event.getByRole("link", { name: "Александр", exact: true });
    await name.hover();
    const card = page.getByRole("dialog", { name: "Организатор: Александр" });
    await expect(
      card.getByRole("button", { name: "Скопировать @user-alex" }),
    ).toBeVisible();
    await card.hover();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(1000);
    await card.getByRole("button", { name: "Скопировать @user-alex" }).click();
    await expect(
      card.getByText("Никнейм скопирован", { exact: true }),
    ).toBeVisible();
    await card.screenshot({
      path: `test-results/organizer-preview-${width}.png`,
    });
    await page.mouse.move(0, 0);
    await expect(card).toBeHidden();
    await expect(page).toHaveURL("/");
    await event.getByRole("heading").getByRole("link").click();
    const field = page.getByRole("textbox", {
      name: "Ваше сообщение",
      exact: true,
    });
    await field.focus();
    await field.press("ControlOrMeta+V");
    await expect(field).toHaveValue("@user-alex");
    await field.pressSequentially(" Привет организатору");
    await page
      .getByRole("button", { name: "Отправить сообщение", exact: true })
      .click();
    await expect(
      page
        .locator(".comment-text")
        .getByRole("link", { name: "@user-alex", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("touch info button opens organization preview and copies representative via selection fallback", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5175",
    storageState: familiarVisitorState,
    viewport: { width: 375, height: 850 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    // Проверяем запасной способ копирования для локальной сети по HTTP без navigator.clipboard.
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      }),
    );
    await signInAs(page, "user-maria");
    const event = page
      .locator(".event-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Утро. Парк. Лёгкий бег.",
          exact: true,
        }),
      });
    await event
      .getByRole("button", { name: "Краткая информация: Беговой клуб «Темп»" })
      .tap();
    const card = page.getByRole("dialog", {
      name: "Организатор: Беговой клуб «Темп»",
    });
    await expect(card.getByText(/Открытый клуб/)).toBeVisible();
    await expect(card.getByText(/Представитель:/)).toBeVisible();
    await card.getByRole("button", { name: "Скопировать @org-run" }).tap();
    await expect(
      card.getByText("Никнейм скопирован", { exact: true }),
    ).toBeVisible();
    await card
      .getByRole("button", { name: "Закрыть карточку организатора" })
      .tap();
    await expect(card).toBeHidden();
    await event.getByRole("heading").getByRole("link").tap();
    const field = page.getByRole("textbox", {
      name: "Ваше сообщение",
      exact: true,
    });
    await field.focus();
    await field.press("ControlOrMeta+V");
    await expect(field).toHaveValue("@org-run");
  } finally {
    await context.close();
  }
});

test("preview supports keyboard focus, Escape and the existing full-profile link", async ({
  page,
}) => {
  await page.goto("/?q=" + encodeURIComponent("Собираемся на баскет"));
  const event = page
    .locator(".event-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Собираемся на баскет",
        exact: true,
      }),
    });
  const info = event.getByRole("button", {
    name: "Краткая информация: Александр",
  });
  await info.focus();
  await info.press("Enter");
  const card = page.getByRole("dialog", { name: "Организатор: Александр" });
  await expect(card).toBeFocused();
  await card.press("Escape");
  await expect(card).toBeHidden();
  await expect(info).toBeFocused();
  await info.press("Enter");
  await card
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(page).toHaveURL(/\/users\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Александр");
});
