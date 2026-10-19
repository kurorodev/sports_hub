import { test, expect } from "@playwright/test";
import { signInAs, createApproval } from "../helpers/approval";
import type { OrganizationDto } from "../../src/shared/api/types";

test.describe.configure({ mode: "serial" });
for (const width of [375, 1440]) {
  test(`Java: actual organizer profile, clipboard and persisted mention at ${width}px`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width, height: 1000 });
    await signInAs(page, "athlete-a");
    const session = await (await page.request.get("/api/v1/session")).json();
    const eventUrl = await createApproval(
      page,
      `Карточка организатора ${width} ${Date.now()}`,
    );
    const userResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/users/${session.user.id}`),
    );
    await page
      .getByRole("button", {
        name: `Краткая информация: ${session.user.displayName}`,
      })
      .click();
    const profileResponse = await userResponse;
    expect(profileResponse.status()).toBe(200);
    expect(profileResponse.fromServiceWorker()).toBe(false);
    const profile = await profileResponse.json();
    const card = page.getByRole("dialog", {
      name: `Организатор: ${session.user.displayName}`,
    });
    await card
      .getByRole("button", { name: `Скопировать @${profile.nickname}` })
      .click();
    await expect(
      card.getByText("Никнейм скопирован", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await signInAs(page, "athlete-b");
    await page.goto(eventUrl);
    const field = page.getByRole("textbox", {
      name: "Ваше сообщение",
      exact: true,
    });
    await field.focus();
    await field.press("ControlOrMeta+V");
    await expect(field).toHaveValue(`@${profile.nickname}`);
    await field.pressSequentially(" Вопрос организатору");
    await page
      .getByRole("button", { name: "Отправить сообщение", exact: true })
      .click();
    const mention = page
      .locator(".comment-text")
      .getByRole("link", { name: `@${profile.nickname}`, exact: true });
    await expect(mention).toHaveAttribute("href", `/users/${profile.id}`);
    await page.reload();
    await expect(mention).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("Java: an organization preview exposes its real representative", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const organizations = await (
    await page.request.get(
      `/api/v1/organizations?q=${encodeURIComponent("Клуб «Темп»")}&size=100`,
    )
  ).json();
  const organization = organizations.items.find(
    (item: OrganizationDto) =>
      item.name === "Клуб «Темп»" && item.status === "APPROVED",
  ) as OrganizationDto;
  expect(organization).toBeTruthy();
  await page.goto(`/organizations/${organization.id}`);
  const event = page.locator(".event-card").first();
  await expect(event).toBeVisible();
  await event
    .getByRole("button", { name: `Краткая информация: ${organization.name}` })
    .click();
  const card = page.getByRole("dialog", {
    name: `Организатор: ${organization.name}`,
  });
  await expect(card.getByText(/Представитель:/)).toBeVisible();
  await card
    .getByRole("button", {
      name: `Скопировать @${organization.createdBy.nickname}`,
    })
    .click();
  await expect(
    card.getByText("Никнейм скопирован", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `@${organization.createdBy.nickname}`,
  );
});
