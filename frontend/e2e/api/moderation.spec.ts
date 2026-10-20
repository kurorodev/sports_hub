import { familiarVisitorState } from "../helpers/site-onboarding";
import { test, expect } from "@playwright/test";
import { signInAs } from "../helpers/approval";
import {
  setupModerationEvent,
  sendDiscussion,
  findModerationEvent,
} from "../helpers/moderation";
for (const width of [375, 768, 1440]) {
  test(`Java S6: isolated moderation, live closure and persistent participant access at ${width}px`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(75000);
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "athlete-a");
    const event = await setupModerationEvent(
      page,
      `Модерация Java ${width} ${Date.now()}`,
    );
    const url = `/events/${event.id}`;
    const options = {
      viewport: { width, height: 1000 },
      serviceWorkers: "block" as const,
      baseURL: "http://127.0.0.1:5174",
      storageState: familiarVisitorState,
    };
    const participantContext = await browser.newContext(options),
      adminContext = await browser.newContext(options),
      guestContext = await browser.newContext(options);
    try {
      const participant = await participantContext.newPage(),
        admin = await adminContext.newPage(),
        guest = await guestContext.newPage();
      await signInAs(participant, "athlete-b");
      await participant.goto(url);
      await participant
        .getByRole("button", { name: "Присоединиться", exact: true })
        .click();
      await expect(
        participant.getByText("Вы участвуете", { exact: true }),
      ).toBeVisible();
      await sendDiscussion(participant, "Проверяемый вопрос Java");
      await page.goto(url);
      await sendDiscussion(page, "Сохраняемый ответ организатора Java");
      const comments = await (
        await participant.request.get(`/api/v1/events/${event.id}/comments`)
      ).json();
      const question = comments.items.find(
        (item: { text: string }) => item.text === "Проверяемый вопрос Java",
      );
      const participantSession = await (
        await participant.request.get("/api/v1/session")
      ).json();
      const unauthorized = await participant.request.post(
        `/api/v1/admin/comments/${question.id}/hide`,
        {
          data: { reason: "Причина" },
          headers: { "X-CSRF-Token": participantSession.csrfToken },
        },
      );
      expect(unauthorized.status()).toBe(403);
      await signInAs(admin, "admin");
      const adminSession = await (
        await admin.request.get("/api/v1/session")
      ).json();
      expect(
        (
          await admin.request.post(
            `/api/v1/admin/comments/${question.id}/hide`,
            { data: { reason: "Без CSRF" } },
          )
        ).status(),
      ).toBe(403);
      expect(
        (
          await admin.request.post(
            `/api/v1/admin/comments/${question.id}/hide`,
            {
              data: { reason: "" },
              headers: { "X-CSRF-Token": adminSession.csrfToken },
            },
          )
        ).status(),
      ).toBe(400);
      expect(
        (
          await participant.request.post(
            `/api/v1/admin/events/${event.id}/unpublish`,
            {
              data: { reason: "Чужое решение" },
              headers: { "X-CSRF-Token": participantSession.csrfToken },
            },
          )
        ).status(),
      ).toBe(403);
      const row = await findModerationEvent(admin, event.title);
      await row
        .getByRole("link", { name: "Комментарии мероприятия", exact: true })
        .click();
      const comment = admin.getByRole("article", {
        name: "Комментарий: Мария Беговая",
        exact: true,
      });
      await comment
        .getByRole("button", { name: "Скрыть комментарий", exact: true })
        .click();
      await admin
        .getByLabel("Причина модерации", { exact: true })
        .fill("Некорректный вопрос Java");
      const hideResponse = admin.waitForResponse(
        (r) =>
          r.url().endsWith(`/admin/comments/${question.id}/hide`) &&
          r.request().method() === "POST",
      );
      await admin
        .getByRole("button", {
          name: "Подтвердить: скрыть комментарий",
          exact: true,
        })
        .click();
      const hidden = await hideResponse;
      expect(hidden.status()).toBe(200);
      expect(hidden.fromServiceWorker()).toBe(false);
      expect(
        (
          await admin.request.post(
            `/api/v1/admin/comments/${question.id}/hide`,
            {
              data: { reason: "Повторное скрытие" },
              headers: { "X-CSRF-Token": adminSession.csrfToken },
            },
          )
        ).status(),
      ).toBe(409);
      await expect(
        participant.getByText("Проверяемый вопрос Java", { exact: true }),
      ).toHaveCount(0, { timeout: 15000 });
      await expect(
        participant.getByText("Сохраняемый ответ организатора Java", {
          exact: true,
        }),
      ).toBeVisible();
      await guest.goto(url);
      await expect(
        guest.getByText("Проверяемый вопрос Java", { exact: true }),
      ).toHaveCount(0);
      await expect(
        guest.getByText("Сохраняемый ответ организатора Java", { exact: true }),
      ).toBeVisible();
      const eventRow = await findModerationEvent(admin, event.title);
      await eventRow
        .getByRole("button", { name: "Снять с публикации", exact: true })
        .click();
      await admin
        .getByLabel("Причина модерации", { exact: true })
        .fill("Условия Java-встречи требуют уточнения.");
      const response = admin.waitForResponse(
        (r) =>
          r.url().endsWith(`/admin/events/${event.id}/unpublish`) &&
          r.request().method() === "POST",
      );
      await admin
        .getByRole("button", {
          name: "Подтвердить: снять с публикации",
          exact: true,
        })
        .click();
      const unpublished = await response;
      expect(unpublished.status()).toBe(200);
      expect(unpublished.fromServiceWorker()).toBe(false);
      // Independent organizer/participant pages observe server changes by polling, without reload.
      await expect(
        participant.getByText("Запись закрыта · Снято с публикации", {
          exact: true,
        }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("Запись закрыта · Снято с публикации", { exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("Условия Java-встречи требуют уточнения.", {
          exact: true,
        }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: /^Уведомления/ }).click();
      await expect(
        page
          .getByRole("dialog", { name: "Уведомления" })
          .locator(".notification-reason")
          .filter({ hasText: "Условия Java-встречи требуют уточнения." })
          .last(),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        participant.getByText("Вы участвуете", { exact: true }),
      ).toBeVisible();
      await expect(
        participant.getByRole("textbox", {
          name: "Ваше сообщение",
          exact: true,
        }),
      ).toHaveCount(0);
      await participant.reload();
      await expect(
        participant.getByText("Условия Java-встречи требуют уточнения.", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        (
          await (
            await participant.request.get(
              `/api/v1/events/${event.id}/my-registration`,
            )
          ).json()
        ).status,
      ).toBe("CONFIRMED");

      expect(
        (
          await admin.request.post(
            `/api/v1/admin/events/${event.id}/unpublish`,
            {
              data: { reason: "Повторное снятие" },
              headers: { "X-CSRF-Token": adminSession.csrfToken },
            },
          )
        ).status(),
      ).toBe(409);
      expect(
        (await guest.request.get(`/api/v1/events/${event.id}`)).status(),
      ).toBe(404);
      await signInAs(guest, "athlete-c");
      await guest.goto(
        `/?q=${encodeURIComponent(event.title)}&includePast=true`,
      );
      await expect(
        guest.getByText("Пока без совпадений", { exact: true }),
      ).toBeVisible();
      const guestSession = await (
        await guest.request.get("/api/v1/session")
      ).json();
      const blocked = await guest.request.post(
        `/api/v1/events/${event.id}/registrations`,
        { data: {}, headers: { "X-CSRF-Token": guestSession.csrfToken } },
      );
      expect(blocked.status()).toBe(409);
      expect((await blocked.json()).code).toBe("EVENT_NOT_AVAILABLE");
      await guest.goto(url);
      await expect(
        guest.getByRole("heading", { name: /сбились с маршрута/ }),
      ).toBeVisible();
      for (const current of [page, participant, admin, guest])
        expect(
          await current.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      await participant.screenshot({
        path: `test-results/java-moderation-${width}.png`,
        fullPage: true,
      });
    } finally {
      await participantContext.close();
      await adminContext.close();
      await guestContext.close();
    }
  });
}
