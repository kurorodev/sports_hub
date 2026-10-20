import { test, expect } from "@playwright/test";

const origin = { latitude: 53.19556, longitude: 50.10102 };
test.use({ permissions: ["geolocation"], geolocation: origin });

for (const width of [375, 1440]) {
  test(`current location: red arrow moves and clears at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
    await context.route("https://tiles.openfreemap.org/**", (route) =>
      route.abort(),
    );
    await page.goto("/map");
    const arrow = page.getByRole("img", {
      name: "Ваше текущее местоположение",
      exact: true,
    });
    await expect(arrow).toHaveCount(0);
    await page
      .getByRole("button", { name: "Моё местоположение", exact: true })
      .click();
    await expect(arrow).toBeVisible();
    await expect(page).toHaveURL(/zoom=14/);
    await expect(arrow.locator("path").first()).toHaveCSS(
      "fill",
      "rgb(227, 49, 62)",
    );
    await expect(arrow).toHaveCSS("pointer-events", "none");
    await expect(
      page.getByRole("button", { name: "Обновить геопозицию", exact: true }),
    ).toBeVisible();
    const before = await arrow.evaluate((element) => element.style.transform);
    const camera = page.url();
    await context.setGeolocation({
      latitude: origin.latitude + 0.001,
      longitude: origin.longitude + 0.001,
    });
    await expect
      .poll(() => arrow.evaluate((element) => element.style.transform))
      .not.toBe(before);
    await expect(arrow).toHaveCount(1);
    await expect(page).toHaveURL(camera);
    await page
      .locator(".map-explorer")
      .screenshot({ path: `/private/tmp/sports-hub-gps-arrow-${width}.png` });
    await page
      .getByRole("button", { name: "Сбросить расстояние", exact: true })
      .click();
    await expect(arrow).toHaveCount(0);
  });
}
