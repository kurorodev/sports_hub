import { test, expect, type Page } from "@playwright/test";

async function register(page: Page, next = "") {
  await page.goto(`/register${next ? `?next=${next}` : ""}`);
  await page
    .getByLabel("Никнейм", { exact: true })
    .fill(`anketa_${Date.now()}`);
  await page.getByLabel("Имя в профиле").fill("Участник анкеты");
  await page.getByLabel("Пароль", { exact: true }).fill("Anketa-password-123");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Найдём спорт по душе" }),
  ).toBeVisible();
}
async function fillPreferences(page: Page, city = "Москва") {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("В каком городе планируешь заниматься?").fill(city);
  await dialog
    .getByLabel("Какие виды спорта тебе интересны?")
    .fill("Баскетбол");
  await dialog
    .getByRole("checkbox", { name: "Баскетбол", exact: true })
    .check();
  await dialog.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Подстроим подборку под тебя" }),
  ).toBeVisible();
  await dialog.getByLabel("Вечером", { exact: true }).check();
}
for (const width of [375, 1440]) {
  test(`registration questionnaire, red cancel and repeat at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await register(page);
    await page
      .getByRole("dialog")
      .screenshot({ path: `/private/tmp/sports-hub-anketa-${width}.png` });
    await fillPreferences(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Сформировать рекомендации" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Твой спорт — твои встречи" }),
    ).toContainText("Москва");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Сформировать рекомендации" }),
    ).toBeEnabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Сформировать рекомендации" })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "Ваши рекомендации уже сформированы",
    });
    await expect(confirm).toBeVisible();
    await confirm.screenshot({
      path: `/private/tmp/sports-hub-anketa-confirm-${width}.png`,
    });
    await expect(confirm.getByRole("button", { name: "Отмена" })).toHaveCSS(
      "background-color",
      "rgb(183, 44, 58)",
    );
    await confirm.getByRole("button", { name: "Отмена" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Сформировать рекомендации" })
      .click();
    await confirm.getByRole("button", { name: "Да", exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByLabel("В каком городе планируешь заниматься?"),
    ).toHaveValue("Москва");
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Убрать Баскетбол" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByLabel("В каком городе планируешь заниматься?")
      .fill("Казань");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Продолжить" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Сформировать рекомендации" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Твой спорт — твои встречи" }),
    ).toContainText("Казань");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("skip survives reload and allows filling in profile", async ({ page }) => {
  await register(page);
  await page.getByRole("button", { name: "Пропустить, заполню позже" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Сформировать рекомендации" }).click();
  await expect(
    page.getByRole("dialog", { name: "Найдём спорт по душе" }),
  ).toBeVisible();
  await fillPreferences(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сформировать рекомендации" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("registration keeps the destination after skipping onboarding", async ({ page }) => {
  await register(page, "create-event");
  await expect(page).toHaveURL("/events/new");
  await page.getByRole("button", { name: "Пропустить анкету", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Название встречи", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Название встречи", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
