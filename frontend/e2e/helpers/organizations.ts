import { expect, type Page } from "@playwright/test";
import type { OrganizationDto } from "../../src/shared/api/types";

export async function applyOrganizationUi(page: Page, name: string) {
  await page.goto("/organization");
  await page.getByLabel("Название организации", { exact: true }).fill(name);
  await page
    .getByLabel("О вашей организации", { exact: true })
    .fill(
      "Помогаем начинающим полюбить спорт. Собираемся в парке и тренируемся вместе.",
    );
  await page.getByLabel("Легкая атлетика", { exact: true }).check();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/organizations") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Отправить заявку организации", exact: true })
    .click();
  const created = await response;
  expect(created.status()).toBe(201);
  const organization: OrganizationDto = await created.json();
  await expect(
    page
      .getByRole("article", { name: `Организация: ${name}`, exact: true })
      .getByText("Заявка на рассмотрении", { exact: true }),
  ).toBeVisible();
  return organization;
}
export async function findOrganizationsForReview(page: Page, q: string) {
  await page.goto("/admin");
  await page
    .getByLabel("Название или описание организации", { exact: true })
    .fill(q);
  await page
    .getByRole("button", { name: "Найти организации", exact: true })
    .click();
}
export async function publishOrganizationEvent(page: Page, title: string) {
  await page.getByLabel("Название встречи", { exact: true }).fill(title);
  await page
    .getByLabel("Вид спорта", { exact: true })
    .selectOption({ label: "Легкая атлетика" });
  await page
    .getByLabel("О встрече", { exact: true })
    .fill(
      "Встречаемся у входа в парк. Пробежка клуба для новичков в спокойном темпе.",
    );
  await page.getByLabel("Город", { exact: true }).fill("Москва");
  await page
    .getByLabel("Место встречи", { exact: true })
    .fill("Парк, главный вход");
  await page
    .getByLabel("Дата", { exact: true })
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Время", { exact: true }).fill("18:30");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/events") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Опубликовать встречу", exact: true })
    .click();
  const created = await response;
  expect(created.status()).toBe(201);
  await expect(
    page.getByText("Встреча опубликована", { exact: true }),
  ).toBeVisible();
  return created;
}
export const organizationEventPayload = (
  organizationId: string,
  sportId: string,
) => ({
  title: "Публикация до допуска",
  description: "Проверяем запрет публикации для неодобренной организации.",
  sport: { sportId },
  startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  location: { city: "Москва", address: "Парк" },
  joinMode: "OPEN",
  maxParticipants: 10,
  organizer: { type: "ORGANIZATION", id: organizationId },
  publishNow: true,
});
