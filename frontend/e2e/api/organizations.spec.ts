import { familiarVisitorState } from "../helpers/site-onboarding";
import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import {
  applyOrganizationUi,
  findOrganizationsForReview,
  publishOrganizationEvent,
  organizationEventPayload,
} from "../helpers/organizations";
for (const width of [375, 768, 1440]) {
  test(`Java S2: approval, refusal and publication across independent sessions at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(75000);
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "coach");
    const prefix = `Клубы Java ${width} ${Date.now()}`;
    const approved = await applyOrganizationUi(page, `${prefix} Бег`);
    const rejected = await applyOrganizationUi(page, `${prefix} Школа`);
    const ownerSession = await (
      await page.request.get("/api/v1/session")
    ).json();
    const attempt = await page.request.post("/api/v1/events", {
      data: organizationEventPayload(approved.id, approved.sports[0].id),
      headers: { "X-CSRF-Token": ownerSession.csrfToken },
    });
    expect(attempt.status()).toBe(403);
    expect((await attempt.json()).code).toBe("ORGANIZATION_NOT_APPROVED");
    const adminContext = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
      baseURL: "http://127.0.0.1:5174",
      storageState: familiarVisitorState,
    });
    const guestContext = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
      baseURL: "http://127.0.0.1:5174",
      storageState: familiarVisitorState,
    });
    try {
      const guest = await guestContext.newPage();
      expect(
        (
          await guest.request.get(`/api/v1/organizations/${approved.id}`)
        ).status(),
      ).toBe(404);
      expect(
        (await page.request.get("/api/v1/admin/organizations")).status(),
      ).toBe(403);
      const admin = await adminContext.newPage();
      await signInAs(admin, "admin");
      await findOrganizationsForReview(admin, prefix);
      await admin
        .getByRole("article", {
          name: `Организация: ${approved.name}`,
          exact: true,
        })
        .getByRole("button", { name: "Одобрить организацию", exact: true })
        .click();
      await admin
        .getByRole("article", {
          name: `Организация: ${rejected.name}`,
          exact: true,
        })
        .getByRole("button", { name: "Отклонить организацию", exact: true })
        .click();
      await admin
        .getByLabel("Причина отказа", { exact: true })
        .fill("Уточните программу занятий для начинающих.");
      await admin
        .getByRole("button", {
          name: "Подтвердить отказ организации",
          exact: true,
        })
        .click();
      // Представитель должен увидеть оба решения через поллинг, без перезагрузки страницы.
      const approvedCard = page.getByRole("article", {
        name: `Организация: ${approved.name}`,
        exact: true,
      });
      await expect(approvedCard).toContainText("Организация подтверждена", {
        timeout: 15000,
      });
      await expect(
        page.getByRole("article", {
          name: `Организация: ${rejected.name}`,
          exact: true,
        }),
      ).toContainText("Уточните программу", { timeout: 15000 });
      await expect(
        approvedCard.getByRole("link", {
          name: "Создать встречу от организации",
          exact: true,
        }),
      ).toBeVisible();
      const currentSession = await (
        await page.request.get("/api/v1/session")
      ).json();
      expect(currentSession.manageableOrganizationIds).toContain(approved.id);
      expect(currentSession.systemRoles).toContain("ORGANIZATION");
      const rejectedAttempt = await page.request.post("/api/v1/events", {
        data: organizationEventPayload(rejected.id, rejected.sports[0].id),
        headers: { "X-CSRF-Token": currentSession.csrfToken },
      });
      expect(rejectedAttempt.status()).toBe(403);
      await page.reload();
      await approvedCard
        .getByRole("link", {
          name: "Создать встречу от организации",
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel("Организатор встречи", { exact: true }),
      ).toHaveValue(approved.id);
      const title = `Встреча клуба Java ${width} ${Date.now()}`;
      const response = await publishOrganizationEvent(page, title);
      expect(response.fromServiceWorker()).toBe(false);
      expect((await response.json()).organizer).toMatchObject({
        id: approved.id,
        type: "ORGANIZATION",
      });
      await page
        .locator(".detail-summary")
        .getByRole("link", { name: approved.name, exact: true })
        .click();
      await page
        .getByRole("link", {
          name: "Создать встречу от организации",
          exact: true,
        })
        .click();
      await publishOrganizationEvent(page, `${title} повторная`);
      await guest.goto(`/organizations?q=${encodeURIComponent(prefix)}`);
      await expect(
        guest.getByRole("article", {
          name: `Организация: ${approved.name}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        guest.getByRole("article", {
          name: `Организация: ${rejected.name}`,
          exact: true,
        }),
      ).toHaveCount(0);
      await guest
        .getByRole("link", { name: approved.name, exact: true })
        .click();
      await guest.reload();
      await expect(
        guest.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        guest.getByRole("heading", { name: `${title} повторная`, exact: true }),
      ).toBeVisible();
      for (const current of [page, admin, guest])
        expect(
          await current.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      await guest.screenshot({
        path: `test-results/java-organization-${width}.png`,
        fullPage: true,
      });
    } finally {
      await adminContext.close();
      await guestContext.close();
    }
  });
}
