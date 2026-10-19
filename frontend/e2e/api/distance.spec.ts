import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import type { Session, Sport } from "../../src/shared/api/types";

const origin = { latitude: 53.19556, longitude: 50.10102, accuracy: 10 };
const north = (meters: number) =>
  origin.latitude + ((meters / 6371000) * 180) / Math.PI;
async function fixtures(page: Page) {
  await signInAs(page, "athlete-a");
  const [sessionResponse, sportsResponse] = await Promise.all([
    page.request.get("/api/v1/session"),
    page.request.get("/api/v1/sports"),
  ]);
  const session: Session = await sessionResponse.json();
  const sports: Sport[] = await sportsResponse.json();
  const q = `GPS-${Date.now()}`;
  const names = {
    near: `${q} Рядом`,
    middle: `${q} Парк`,
    far: `${q} Далеко`,
    unpinned: `${q} Без точки`,
  };
  for (const [name, meters] of [
    [names.near, 50],
    [names.middle, 450],
    [names.far, 5200],
    [names.unpinned, null],
  ] as const) {
    const response = await page.request.post("/api/v1/events", {
      headers: { "X-CSRF-Token": session.csrfToken },
      data: {
        title: name,
        description: "Проверяем расстояние до спортивной встречи.",
        sport: { sportId: sports[0].id },
        startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        location: {
          city: "Самара",
          address: "Точка для проверки GPS",
          ...(meters === null
            ? {}
            : { latitude: north(meters), longitude: origin.longitude }),
        },
        joinMode: "OPEN",
        skillLevel: "ANY",
        eventKind: "ACTIVITY",
        maxParticipants: 10,
        organizer: { type: "USER", id: session.user.id },
        publishNow: true,
      },
    });
    expect(response.status()).toBe(201);
  }
  return { q, ...names };
}

test.use({ permissions: ["geolocation"], geolocation: origin });
for (const width of [375, 1440]) {
  test(`GPS: cards, presets, movement and map round trip at ${width}px`, async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await context.route("https://tiles.openfreemap.org/**", (route) =>
      route.abort(),
    );
    const names = await fixtures(page);
    await page.goto(`/?q=${names.q}#activities`);
    const cards = page.locator(".event-card");
    const radius = page.getByRole("combobox", {
      name: "Расстояние до мероприятия",
      exact: true,
    });
    await expect(cards).toHaveCount(4);
    await expect(radius).toBeDisabled();
    await page
      .getByRole("button", { name: "Использовать геолокацию", exact: true })
      .click();
    await expect(cards.filter({ hasText: names.near })).toContainText(
      "≈ 50 м от вас",
    );
    await expect(cards.filter({ hasText: names.unpinned })).toContainText(
      "Расстояние не определено",
    );
    expect(
      await radius
        .locator("option")
        .evaluateAll((items) =>
          items.map((item) => (item as HTMLOptionElement).value),
        ),
    ).toEqual(["", "100", "200", "500", "1000", "2000", "3000", "5000"]);
    await radius.selectOption("100");
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText(names.near);
    await radius.selectOption("500");
    await expect(cards).toHaveCount(2);
    await page
      .getByRole("combobox", { name: "Город", exact: true })
      .selectOption("Москва");
    await expect(cards).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "Город", exact: true })
      .selectOption("Самара");
    await expect(cards).toHaveCount(2);
    expect(page.url()).not.toContain("originLatitude");
    await page.screenshot({
      path: `test-results/gps-distance-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "На карте", exact: true }).click();
    const mapItems = page.getByRole("region", {
      name: "Мероприятия в этой области",
      exact: true,
    });
    await expect(mapItems.getByText(names.near, { exact: true })).toBeVisible();
    await expect(mapItems.getByText(names.far, { exact: true })).toHaveCount(0);
    await expect(radius).toHaveValue("500");
    await page.getByRole("link", { name: "Список", exact: true }).click();
    await expect(cards).toHaveCount(2);
    await context.setGeolocation({
      latitude: north(6000),
      longitude: origin.longitude,
      accuracy: 10,
    });
    await radius.selectOption("2000");
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText(names.far);
    await expect(cards).toContainText("≈ 800 м от вас");
    await page.reload();
    await expect(page.getByText(/Включите геолокацию в фильтре/)).toBeVisible();
    await expect(radius).toBeDisabled();
    await expect(cards).toHaveCount(0);
    await page
      .getByRole("button", { name: "Сбросить расстояние", exact: true })
      .click();
    await expect(cards).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("GPS: permission denial keeps radius blocked until it is explicitly reset", async ({
  page,
}) => {
  const names = await fixtures(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: (
          _ok: unknown,
          fail: (error: { code: number }) => void,
        ) => {
          queueMicrotask(() => fail({ code: 1 }));
          return 42;
        },
        clearWatch: () => {},
      },
      configurable: true,
    });
  });
  await page.goto(`/?q=${names.q}&radiusMeters=100#activities`);
  await expect(page.getByText(/Включите геолокацию в фильтре/)).toBeVisible();
  await page
    .getByRole("button", { name: "Использовать геолокацию", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Доступ к геолокации запрещён",
  );
  await expect(page.locator(".event-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Сбросить расстояние", exact: true })
    .click();
  await expect(page.locator(".event-card")).toHaveCount(4);
});
