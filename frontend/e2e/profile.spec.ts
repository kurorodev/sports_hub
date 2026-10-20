import { selectCity } from "./helpers/cities";
import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";
import type { UserProfileDto } from "../src/shared/api/types";
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`profile editing, public reading and author links persist at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .context()
      .route("https://example.com/**", (route) =>
        route.fulfill({ status: 404, body: "Unavailable avatar" }),
      );
    await signInAs(page, "user-alex");
    await page.locator(".header-account").click();
    await expect(page).toHaveURL("/profile");
    await page
      .getByRole("button", { name: "Редактировать профиль", exact: true })
      .click();
    const name =
      width === 320
        ? "Александр " + "Спорт".repeat(18)
        : `Александр Профиль ${width}`;
    await page.getByLabel("Имя в профиле", { exact: true }).fill(name);
    await page
      .getByLabel("Никнейм", { exact: true })
      .fill(`alex-profile-${width}`);
    await selectCity(page, "Самара");
    await page
      .getByLabel("О себе", { exact: true })
      .fill("Люблю бег и новые знакомства. <b>Без спешки</b>.");
    await page
      .getByLabel("Когда удобно заниматься", { exact: true })
      .selectOption("EVENING");
    await page.getByLabel("Тренер", { exact: true }).check();
    await page.getByLabel("Легкая атлетика", { exact: true }).check();
    await page
      .getByLabel("Уровень: Легкая атлетика", { exact: true })
      .selectOption("AMATEUR");
    await page
      .getByText("Использовать своё изображение по ссылке", { exact: true })
      .click();
    await page
      .getByLabel("Ссылка на аватар", { exact: true })
      .fill("javascript:alert(1)");
    await page
      .getByRole("button", { name: "Сохранить профиль", exact: true })
      .click();
    await expect(
      page.getByText(
        "Выберите аватар или укажите ссылку http/https без логина и пароля, до 2048 символов",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByLabel("Ссылка на аватар", { exact: true })
      .fill("https://example.com/missing-profile-avatar.png");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/me/profile") &&
        r.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "Сохранить профиль", exact: true })
      .click();
    const saved = await response;
    expect(saved.status()).toBe(200);
    const profile: UserProfileDto = await saved.json();
    for (const key of ["ratingPoints", "rank", "systemRoles", "id"])
      expect(saved.request().postDataJSON()).not.toHaveProperty(key);
    await expect(
      page.getByText("Профиль сохранён", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".header-account")).toContainText(name);
    await expect(page.locator(".profile-avatar img")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(
      page.getByRole("region", { name: "Спортивные интересы" }),
    ).toContainText("Легкая атлетика");
    await expect(page.getByText("Любитель", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/profile-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Посмотреть публичный профиль" })
      .click();
    await expect(page).toHaveURL(`/users/${profile.id}`);
    await signInAs(page, "user-maria");
    await page.goto(`/users/${profile.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(
      page.getByRole("link", { name: "Редактировать свой профиль" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Редактировать профиль", exact: true }),
    ).toHaveCount(0);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Мария");
    await page.goto("/events/6d69380d-0000-4000-8000-000000000000");
    await page
      .locator(".detail-summary")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  });
}

test("guest returns to own profile after login and participant links open public profiles", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Твой спортивный профиль" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Войти в профиль" }).click();
  await page.locator('input[value="user-maria"]').check();
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page).toHaveURL("/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Мария");
  await page.goto("/events/82e2dd5f-0000-4000-8000-000000000000");
  await page
    .getByRole("list", { name: "Кто идёт" })
    .getByRole("link", { name: "Анастасия", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Анастасия");
  await page.goto("/users/not-a-uuid");
  await expect(
    page.getByRole("heading", { name: /сбились с маршрута/ }),
  ).toBeVisible();
  await page.goto("/users/00000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("heading", { name: /сбились с маршрута/ }),
  ).toBeVisible();
});
