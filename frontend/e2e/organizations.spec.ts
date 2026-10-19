import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";
import {
  applyOrganizationUi,
  findOrganizationsForReview,
  publishOrganizationEvent,
} from "./helpers/organizations";
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`S2 both organization decisions and publication persist at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.clock.setFixedTime(new Date("2026-10-19T00:00:00Z"));
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-alex");
    const prefix = `Новые клубы ${width}`;
    const approved = await applyOrganizationUi(
      page,
      `${prefix} ${width === 320 ? "Б".repeat(120) : "Бег"}`,
    );
    const rejected = await applyOrganizationUi(page, `${prefix} Школа`);
    await page.goto(`/events/new?organizationId=${approved.id}`);
    await expect(
      page.getByRole("heading", {
        name: "Публикация от организации недоступна",
        exact: true,
      }),
    ).toBeVisible();
    await signInAs(page, "admin");
    await findOrganizationsForReview(page, prefix);
    await page
      .getByRole("article", {
        name: `Организация: ${approved.name}`,
        exact: true,
      })
      .getByRole("button", { name: "Одобрить организацию", exact: true })
      .click();
    const rejectedCard = page.getByRole("article", {
      name: `Организация: ${rejected.name}`,
      exact: true,
    });
    await rejectedCard
      .getByRole("button", { name: "Отклонить организацию", exact: true })
      .click();
    await expect(
      page.getByLabel("Причина отказа", { exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", {
        name: "Подтвердить отказ организации",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Укажите причину: от 3 символов", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Причина отказа", { exact: true })
      .fill("Уточните направления и формат тренировок.");
    await page
      .getByRole("button", {
        name: "Подтвердить отказ организации",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        "Нет организаций по этим условиям. Измените поиск или статус.",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByLabel("Статус организаций", { exact: true })
      .selectOption("REJECTED");
    await expect(rejectedCard).toContainText("Уточните направления");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/organization-admin-${width}.png`,
      fullPage: true,
    });
    await signInAs(page, "user-alex");
    await page.goto("/organization");
    await page.reload();
    await expect(
      page.getByRole("article", {
        name: `Организация: ${rejected.name}`,
        exact: true,
      }),
    ).toContainText("Заявка отклонена");
    const approvedCard = page.getByRole("article", {
      name: `Организация: ${approved.name}`,
      exact: true,
    });
    await expect(approvedCard).toContainText("Организация подтверждена");
    await approvedCard
      .getByRole("link", {
        name: "Создать встречу от организации",
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel("Организатор встречи", { exact: true }),
    ).toHaveValue(approved.id);
    const title = `Пробежка организации ${width}`;
    await publishOrganizationEvent(page, title);
    await expect(
      page
        .locator(".detail-summary")
        .getByRole("link", { name: approved.name, exact: true }),
    ).toBeVisible();
    await page
      .locator(".detail-summary")
      .getByRole("link", { name: approved.name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name: "Создать встречу от организации",
        exact: true,
      })
      .click();
    await publishOrganizationEvent(page, `${title} вторая`);
    await signInAs(page, "user-maria");
    await page.goto(`/organizations?q=${encodeURIComponent(prefix)}`);
    await expect(
      page.getByRole("article", {
        name: `Организация: ${approved.name}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", {
        name: `Организация: ${rejected.name}`,
        exact: true,
      }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: approved.name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `${title} вторая`, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/organization-public-${width}.png`,
      fullPage: true,
    });
    await page.goto(`/organizations/${rejected.id}`);
    await expect(
      page.getByRole("heading", { name: /сбились с маршрута/ }),
    ).toBeVisible();
  });
}

test("guest enters organization application after login and invalid profile URL is not found", async ({
  page,
}) => {
  await page.goto("/organizations");
  await page
    .getByRole("link", { name: "Добавить организацию", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Войти в аккаунт", exact: true })
    .click();
  await page.locator('input[value="user-maria"]').check();
  await page
    .getByRole("button", { name: "Войти в аккаунт", exact: true })
    .click();
  await expect(page).toHaveURL("/organizations?view=apply");
  await expect(
    page.getByLabel("Название организации", { exact: true }),
  ).toBeVisible();
  await page.goto("/organizations/not-a-uuid");
  await expect(
    page.getByRole("heading", { name: /сбились с маршрута/ }),
  ).toBeVisible();
});
