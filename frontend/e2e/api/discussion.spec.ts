import { familiarVisitorState } from "../helpers/site-onboarding";
import { test, expect } from "@playwright/test";
import { signInAs, createApproval } from "../helpers/approval";

for (const width of [375, 768, 1440]) {
  test(`Java S5: public discussion without registration across sessions at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(60000); // Two independent clients observe server changes through 10-second polling.
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "athlete-a");
    const url = await createApproval(
      page,
      `Обсуждение Java ${width} ${Date.now()}`,
    );
    const eventId = new URL(url).pathname.split("/").at(-1)!;
    const commentsPath = `/api/v1/events/${eventId}/comments`;
    const context = await browser.newContext({
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
    const participant = await context.newPage();
    try {
      await signInAs(participant, "athlete-b");
      await participant.goto(url);
      expect(
        (
          await participant.request.get(
            `/api/v1/events/${eventId}/my-registration`,
          )
        ).status(),
      ).toBe(404);
      const blocked = await participant.request.post(commentsPath, {
        data: { text: "Без CSRF" },
      });
      expect(blocked.status()).toBe(403);
      const session = await (
        await participant.request.get("/api/v1/session")
      ).json();
      for (const text of ["", "a".repeat(2001)]) {
        const invalid = await participant.request.post(commentsPath, {
          data: { text },
          headers: { "X-CSRF-Token": session.csrfToken },
        });
        expect(invalid.status()).toBe(400);
        expect((await invalid.json()).code).toBe("VALIDATION_ERROR");
      }
      const response = participant.waitForResponse(
        (r) =>
          r.url().endsWith(commentsPath) && r.request().method() === "POST",
      );
      await participant
        .getByRole("textbox", { name: "Ваше сообщение" })
        .fill("Можно новичку? Возьму воду и кроссовки.");
      await participant
        .getByRole("button", { name: "Отправить сообщение", exact: true })
        .click();
      const published = await response;
      expect(published.status()).toBe(201);
      expect(published.fromServiceWorker()).toBe(false);
      await expect(
        participant.getByText("Сообщение опубликовано.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("article", {
          name: "Сообщение: Мария Беговая",
          exact: true,
        }),
      ).toContainText("Можно новичку?", { timeout: 15000 });
      await page
        .getByRole("textbox", { name: "Ваше сообщение" })
        .fill("Конечно. Встречаемся у главного входа, темп спокойный.");
      await page
        .getByRole("button", { name: "Отправить сообщение", exact: true })
        .click();
      const answer = participant.getByRole("article", {
        name: "Сообщение: Алексей Спортов",
        exact: true,
      });
      await expect(answer).toContainText("темп спокойный", { timeout: 15000 });
      await expect(
        answer.getByText("Организатор", { exact: true }),
      ).toBeVisible();
      await expect(
        participant.getByRole("button", { name: "Подать заявку", exact: true }),
      ).toBeVisible();
      expect(
        (
          await participant.request.get(
            `/api/v1/events/${eventId}/my-registration`,
          )
        ).status(),
      ).toBe(404);
      await participant.reload();
      await page.reload();
      await expect(
        participant.getByText("Сообщений: 2", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Сообщений: 2", { exact: true }),
      ).toBeVisible();
      const guest = await guestContext.newPage();
      await guest.goto(url);
      await expect(
        guest.getByRole("article", {
          name: "Сообщение: Мария Беговая",
          exact: true,
        }),
      ).toContainText("Можно новичку?");
      await expect(
        guest.getByRole("link", { name: "Войти и написать" }),
      ).toBeVisible();
      await expect(
        guest.getByRole("textbox", { name: "Ваше сообщение" }),
      ).toHaveCount(0);
      expect((await guest.request.get(commentsPath)).status()).toBe(200);
      expect((await guest.request.get("/api/v1/session")).status()).toBe(401);
      for (const current of [page, participant, guest])
        expect(
          await current.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      await participant
        .locator("#event-discussion")
        .screenshot({ path: `test-results/java-discussion-${width}.png` });
    } finally {
      await context.close();
      await guestContext.close();
    }
  });
}
