import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";
for (const width of [375, 1440]) {
  test(`language and theme persist across navigation and reload at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, "user-alex");
    await page.goto("/profile");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Interface settings", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("button", { name: "Edit profile", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Dark", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/preferences-dark-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Edit profile", exact: true })
      .click();
    const name = page.getByLabel("Profile name", { exact: true });
    await name.fill("Имя без сохранения");
    await page.getByRole("button", { name: "RU", exact: true }).click();
    await expect(page.getByLabel("Имя в профиле", { exact: true })).toHaveValue(
      "Имя без сохранения",
    );
    await page.getByRole("button", { name: "Светлая", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page
      .getByRole("button", { name: "Отменить изменения", exact: true })
      .click();
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Activities", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Choose an activity", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Search activities", exact: true }),
    ).toBeVisible();
    await page.goto("/support");
    await expect(
      page.getByRole("heading", { name: "Support center", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/support-light-${width}.png`,
      fullPage: true,
    });
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Interface settings", exact: true }),
    ).toBeVisible();
  });
}
