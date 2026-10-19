import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import type {
  UserProfileDto,
  ProfilePatchDto,
  Session,
} from "../../src/shared/api/types";
for (const width of [375, 768, 1440]) {
  test(`Java profile: edit, conflict, public privacy and reload at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "athlete-c");
    const originalResponse = await page.request.get("/api/v1/me/profile");
    expect(originalResponse.status()).toBe(200);
    const original: UserProfileDto = await originalResponse.json();
    const otherContext = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
      baseURL: "http://127.0.0.1:5174",
    });
    const guestContext = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
      baseURL: "http://127.0.0.1:5174",
    });
    try {
      const other = await otherContext.newPage(),
        guest = await guestContext.newPage();
      await signInAs(other, "athlete-b");
      const otherSession: Session = await (
        await other.request.get("/api/v1/session")
      ).json();
      await page.locator(".header-account").click();
      await page
        .getByRole("button", { name: "Редактировать профиль", exact: true })
        .click();
      const newName = `Ирина Профиль ${width}`;
      await page.getByLabel("Имя в профиле", { exact: true }).fill(newName);
      await page
        .getByLabel("О себе", { exact: true })
        .fill(`Бегаю и знакомлюсь · ${width}`);
      await page.getByLabel("Город", { exact: true }).fill("Самара");
      await page
        .getByLabel("Никнейм", { exact: true })
        .fill(otherSession.user.nickname);
      await page
        .getByRole("button", { name: "Сохранить профиль", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText("Никнейм уже занят");
      await expect(page.getByLabel("О себе", { exact: true })).toHaveValue(
        `Бегаю и знакомлюсь · ${width}`,
      );
      await page
        .getByLabel("Никнейм", { exact: true })
        .fill(`profile-${width}-${Date.now()}`);
      await page
        .getByLabel("Когда удобно заниматься", { exact: true })
        .selectOption("MORNING");
      await page.getByLabel("Тренер", { exact: true }).check();
      await page.getByLabel("Бег", { exact: true }).check();
      await page
        .getByLabel("Уровень: Бег", { exact: true })
        .selectOption("AMATEUR");
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
      expect(saved.fromServiceWorker()).toBe(false);
      await expect(
        page.getByText("Профиль сохранён", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".header-account")).toContainText(newName);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(newName);
      await expect(
        page.getByRole("region", { name: "Спортивные интересы" }),
      ).toContainText("Бег");
      await expect(page.getByText("Любитель", { exact: true })).toBeVisible();
      const currentSession: Session = await (
        await page.request.get("/api/v1/session")
      ).json();
      expect(currentSession.systemRoles).toEqual(["USER"]);
      expect((await page.request.get("/api/v1/admin/events")).status()).toBe(
        403,
      );
      expect(
        (
          await page.request.patch("/api/v1/me/profile", {
            data: { bio: "Без CSRF" },
          })
        ).status(),
      ).toBe(403);
      for (const body of [{ ratingPoints: 99999 }, { systemRoles: ["ADMIN"] }])
        expect(
          (
            await page.request.patch("/api/v1/me/profile", {
              data: body,
              headers: { "X-CSRF-Token": currentSession.csrfToken },
            })
          ).status(),
        ).toBe(400);
      const publicResponse = guest.waitForResponse((r) =>
        r.url().endsWith(`/api/v1/users/${original.id}`),
      );
      await guest.goto(`/users/${original.id}`);
      expect((await publicResponse).status()).toBe(200);
      await expect(guest.getByRole("heading", { level: 1 })).toHaveText(
        newName,
      );
      await expect(
        guest.getByRole("link", { name: "Редактировать свой профиль" }),
      ).toHaveCount(0);
      const publicData = await (
        await guest.request.get(`/api/v1/users/${original.id}`)
      ).json();
      for (const key of ["systemRoles", "csrfToken", "demoAccountId"])
        expect(publicData).not.toHaveProperty(key);
      expect(publicData.ratingPoints).toBe(original.ratingPoints);
      expect(publicData.rank).toBe(original.rank);
      await other.goto(`/users/${original.id}`);
      await expect(other.getByRole("heading", { level: 1 })).toHaveText(
        newName,
      );
      await expect(
        other.getByRole("link", { name: "Редактировать свой профиль" }),
      ).toHaveCount(0);
      await guest.goto("/profile");
      await expect(
        guest.getByRole("link", { name: "Войти в профиль" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await other.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/java-profile-${width}.png`,
        fullPage: true,
      });
    } finally {
      // Keep shared demo accounts unchanged for S1–S6 and subsequent test runs.
      const session: Session = await (
        await page.request.get("/api/v1/session")
      ).json();
      const restore: ProfilePatchDto = {
        displayName: original.displayName,
        nickname: original.nickname,
        firstName: original.firstName ?? null,
        lastName: original.lastName ?? null,
        bio: original.bio ?? null,
        city: original.city ?? null,
        avatarUrl: original.avatarUrl ?? null,
        sportsRoles: original.sportsRoles,
        sportsPreferences: original.sportsPreferences,
        preferredTime: original.preferredTime ?? null,
      };
      const restored = await page.request.patch("/api/v1/me/profile", {
        data: restore,
        headers: { "X-CSRF-Token": session.csrfToken },
      });
      await otherContext.close();
      await guestContext.close();
      expect(restored.status()).toBe(200);
    }
  });
}
