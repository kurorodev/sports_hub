import type { Locator, Page } from "@playwright/test";

export async function selectCity(
  scope: Page | Locator,
  city: string,
  label = "Город",
) {
  await scope.getByLabel(label, { exact: true }).click();
  await scope
    .getByRole("combobox", { name: "Поиск города", exact: true })
    .fill(city);
  await scope.getByRole("option", { name: city, exact: true }).click();
}
