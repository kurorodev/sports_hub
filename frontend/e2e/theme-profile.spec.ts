import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers/approval";
for (const width of [375, 1440]) {
  test(`light default and simplified profile at ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, "user-alex");
    await page.goto("/profile");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator(".profile-rating")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Редактировать профиль", exact: true })
      .click();
    await expect(
      page.getByRole("group", { name: "Спортивные роли", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Отменить изменения", exact: true })
      .click();
    await page.screenshot({
      path: `test-results/profile-light-default-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Тёмная", exact: true }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page
      .getByRole("link", { name: "Посмотреть публичный профиль", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Александр", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".profile-rating")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
