import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

for (const width of [375, 1440]) {
  test(`favorite sport, age, scope and pagination at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "user-maria");
    const football = await page.evaluate(async () => {
      const session = await (await fetch("/api/v1/session")).json();
      const sports = await (await fetch("/api/v1/sports")).json();
      const football = sports.find(
        (sport: { name: string }) => sport.name === "Футбол",
      ).id;
      const basketball = sports.find(
        (sport: { name: string }) => sport.name === "Баскетбол",
      ).id;
      const start = new Date(Date.now() + 10 * 86400000);
      start.setHours(18, 0, 0, 0);
      const fixtures = [
        ...Array.from({ length: 7 }, (_, i) => ({
          title: `Футбол для друзей ${i + 1}`,
          sport: { sportId: football },
          city: "Самара",
          min: 55,
          max: 75,
          offset: 0,
        })),
        {
          title: "Футбол своей компанией",
          sport: { customName: "ФУТБОЛ" },
          city: "Самара",
          min: null,
          max: null,
          offset: 0,
        },
        {
          title: "Футбол в Казани",
          sport: { sportId: football },
          city: "Казань",
          min: 55,
          max: 75,
          offset: -86400000,
        },
        {
          title: "Баскетбол для друзей",
          sport: { sportId: basketball },
          city: "Самара",
          min: 55,
          max: 75,
          offset: 0,
        },
        {
          title: "Детский футбол",
          sport: { sportId: football },
          city: "Самара",
          min: 10,
          max: 16,
          offset: 0,
        },
      ];
      for (const fixture of fixtures) {
        const response = await fetch("/api/v1/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrfToken,
          },
          body: JSON.stringify({
            title: fixture.title,
            description: "Встреча друзей для совместных занятий спортом.",
            sport: fixture.sport,
            startsAt: new Date(start.getTime() + fixture.offset).toISOString(),
            location: { city: fixture.city, address: "Спортивная площадка" },
            skillLevel: "ANY",
            eventKind: "ACTIVITY",
            joinMode: "OPEN",
            maxParticipants: 10,
            organizer: { type: "USER", id: session.user.id },
            recommendedMinAge: fixture.min,
            recommendedMaxAge: fixture.max,
          }),
        });
        if (!response.ok) throw new Error(await response.text());
      }
      return football as string;
    });
    await signInAs(page, "user-alex");
    await page.evaluate(async (sportId) => {
      const session = await (await fetch("/api/v1/session")).json();
      const response = await fetch("/api/v1/me/questionnaire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        },
        body: JSON.stringify({
          city: "Самара",
          sportsPreferences: [{ sportId, level: "BEGINNER" }],
          preferredTime: "EVENING",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          age: 60,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
    }, football);
    await page.goto("/profile");
    const recommendations = page.getByRole("region", {
      name: "Твой спорт — твои встречи",
    });
    await expect(recommendations.locator(".recommended-event")).toHaveCount(6);
    await expect(recommendations).toContainText("Возраст: 60");
    await expect(recommendations).not.toContainText("Детский футбол");
    await expect(recommendations).not.toContainText("Баскетбол для друзей");
    await expect(recommendations).not.toContainText("Футбол в Казани");
    await recommendations
      .getByRole("button", { name: "Далее", exact: true })
      .click();
    await expect(recommendations.locator(".recommended-event")).toHaveCount(2);
    await expect(recommendations).toContainText("Футбол своей компанией");
    await recommendations.getByLabel("Искать во всех городах").check();
    await expect(recommendations).toContainText("Страница 1 из 2");
    await expect(recommendations).toContainText("Футбол в Казани");
    await recommendations.getByLabel("Предлагать другие виды спорта").check();
    await recommendations
      .getByRole("button", { name: "Далее", exact: true })
      .click();
    await expect(recommendations).toContainText("Баскетбол для друзей");
    await expect(recommendations).not.toContainText("Детский футбол");
    await recommendations
      .getByRole("button", { name: "Сформировать рекомендации" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Да", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Продолжить", exact: true })
      .click();
    await expect(page.getByLabel("Возраст, лет — необязательно")).toHaveValue(
      "60",
    );
    await page.getByLabel("Возраст, лет — необязательно").fill("61");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Сформировать рекомендации" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(recommendations).toContainText("Возраст: 61");
    await page.reload();
    await expect(recommendations).toContainText("Возраст: 61");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await recommendations.screenshot({
      path: `test-results/recommendations-${width}.png`,
    });
  });
}
