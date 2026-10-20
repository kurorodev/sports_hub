import { familiarVisitorState } from "../helpers/site-onboarding";
import { test, expect } from "@playwright/test";
import {
  signInAs,
  createApproval,
  requestParticipation,
} from "../helpers/approval";
for (const width of [375, 768, 1440]) {
  test(`Java S4: both decisions propagate between sessions at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(75000); // Separate sessions poll for new applications and decisions.
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "athlete-a");
    const url = await createApproval(
      page,
      `Бег по заявке Java ${width} ${Date.now()}`,
    );
    const emptyAction = page.getByRole("button", { name: "Новых заявок нет" });
    const reviewAction = page.getByRole("link", { name: "Рассмотреть заявки" });
    await expect(emptyAction).toBeDisabled();
    const participantContext = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: "block",
      baseURL: "http://127.0.0.1:5174",
      storageState: familiarVisitorState,
    });
    const participant = await participantContext.newPage();
    try {
      await signInAs(participant, "athlete-b");
      await requestParticipation(participant, url);
      await expect(reviewAction).toBeVisible({ timeout: 15000 });
      await expect(reviewAction).toHaveCSS("background-color", "rgb(255, 204, 22)");
      await page
        .getByRole("button", { name: "Обновить заявки", exact: true })
        .click();
      const requests = page.getByRole("list", { name: "Заявки на участие" });
      await requests
        .getByRole("listitem", { name: "Заявка: Мария Беговая", exact: true })
        .getByRole("button", { name: "Одобрить", exact: true })
        .click();
      await expect(emptyAction).toBeDisabled();
      // No reload/refetch click in the participant session: only real HTTP polling can update this page.
      await expect(
        participant.getByText("Заявка одобрена. До встречи!", { exact: true }),
      ).toBeVisible({ timeout: 12000 });
      await expect(
        participant.getByText("1 из 2 участников", { exact: true }),
      ).toBeVisible();
      await participant.reload();
      await expect(
        participant.getByText("Вы участвуете", { exact: true }),
      ).toBeVisible();
      await signInAs(participant, "athlete-c");
      await participant.goto(url);
      await participant
        .getByRole("button", { name: "Подать заявку", exact: true })
        .click();
      await expect(
        participant.getByText("Ожидает решения", { exact: true }),
      ).toBeVisible();
      await expect(reviewAction).toBeVisible({ timeout: 15000 });
      await page
        .getByRole("button", { name: "Обновить заявки", exact: true })
        .click();
      await requests
        .getByRole("listitem", { name: "Заявка: Ирина Новая", exact: true })
        .getByRole("button", { name: "Отклонить", exact: true })
        .click();
      await page
        .getByLabel("Причина отказа (необязательно)")
        .fill("Для этой встречи нужна другая подготовка.");
      await page
        .getByRole("button", { name: "Подтвердить отказ", exact: true })
        .click();
      await expect(emptyAction).toBeDisabled();
      await expect(emptyAction).toHaveCSS("background-color", "rgb(239, 239, 237)");
      await expect(
        participant.getByText("Заявка отклонена", { exact: true }),
      ).toBeVisible({ timeout: 12000 });
      await expect(
        participant.getByText("Для этой встречи нужна другая подготовка.", {
          exact: true,
        }),
      ).toBeVisible();
      await participant.reload();
      await expect(
        participant.getByText("Заявка отклонена", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("Статус заявок").selectOption("REJECTED");
      await expect(
        requests.getByText("Ирина Новая", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("Статус заявок").selectOption("CONFIRMED");
      await expect(
        requests.getByText("Мария Беговая", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("list", { name: "Кто идёт" })
          .getByText("Ирина Новая", { exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      // ADMIN may read requests, but cannot replace the organizer's decision.
      await signInAs(participant, "admin");
      const eventId = new URL(url).pathname.split("/").at(-1)!;
      const adminSession = await (
        await participant.request.get("/api/v1/session")
      ).json();
      const readResponse = await participant.request.get(
        `/api/v1/events/${eventId}/registrations?status=CONFIRMED`,
      );
      expect(readResponse.status()).toBe(200);
      const confirmed = await readResponse.json();
      const unauthorized = await participant.request.post(
        `/api/v1/events/${eventId}/registrations/${confirmed.items[0].id}/decision`,
        {
          data: { decision: "REJECT" },
          headers: { "X-CSRF-Token": adminSession.csrfToken },
        },
      );
      expect(unauthorized.status()).toBe(403);
      await page.screenshot({
        path: `test-results/java-approval-${width}.png`,
        fullPage: true,
      });
    } finally {
      await participantContext.close();
    }
  });
}
