import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

for (const width of [375, 1440]) {
  test(`profile layout, role permissions and compact venue preview at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, "user-alex");
    await expect(
      page.getByRole("button", { name: /Изменить анкету/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Изменить анкету/ }),
    ).toHaveCount(0);
    await page.goto("/profile");
    const avatar = page.locator(".profile-avatar");
    await expect(avatar.locator("img")).toBeVisible();
    await expect(avatar).not.toHaveCSS("background-color", "rgb(255, 204, 22)");
    const portrait = await avatar.evaluate((el) => {
      const inside = el.querySelector(".user-avatar")!;
      return {
        outer: getComputedStyle(el).borderRadius,
        inner: getComputedStyle(inside).borderRadius,
      };
    });
    expect(portrait.inner).toBe(portrait.outer);
    await avatar.screenshot({ path: `test-results/avatar-fixed-${width}.png` });
    const selection = page.locator(".profile-recommendations");
    await expect(selection).toBeVisible();
    expect(
      await selection.evaluate((el) =>
        parseFloat(getComputedStyle(el).paddingLeft),
      ),
    ).toBeGreaterThanOrEqual(20);
    await selection.screenshot({
      path: `test-results/recommendations-fixed-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Редактировать профиль", exact: true })
      .click();
    await expect(
      page.getByRole("group", { name: "Спортивные роли", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Имя в профиле", { exact: true })
      .fill("Профиль после исправлений");
    await page
      .getByRole("button", { name: "Сохранить профиль", exact: true })
      .click();
    await expect(
      page.getByText("Профиль сохранён", { exact: true }),
    ).toBeVisible();
    const denied = await page.evaluate(async () => {
      const session = await (await fetch("/api/v1/session")).json();
      return (
        await fetch("/api/v1/me/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({ sportsRoles: ["SPORTS_ORGANIZER"] }),
        })
      ).status;
    });
    expect(denied).toBe(403);
    await signInAs(page, "org-run");
    await page.goto("/profile?edit=1");
    await expect(
      page.getByRole("group", { name: "Спортивные роли", exact: true }),
    ).toBeVisible();
    await page.goto("/map");
    const venue = page
      .locator(".map-result")
      .filter({ has: page.locator(".venue-week-preview") })
      .first();
    await venue
      .getByRole("button", { name: "Показать на карте", exact: true })
      .click();
    const card = page.locator(".map-selection");
    await expect(card.locator(".venue-week-bar")).toHaveCount(7);
    await expect(card.locator(".venue-week-legend")).toHaveCount(0);
    await expect(card.getByText(/^(Низкая|Средняя|Высокая)$/)).toHaveCount(0);
    const layout = await card.evaluate((el) => ({
      height: el.clientHeight,
      scroll: el.scrollHeight,
      overflow: el.scrollWidth > el.clientWidth,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(layout.scroll).toBeLessThanOrEqual(layout.height + 1);
    expect(layout.overflow || layout.pageOverflow).toBe(false);
    await card.screenshot({ path: `test-results/venue-compact-${width}.png` });
  });
}
