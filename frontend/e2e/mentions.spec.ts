import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers/approval";

test("mention selection persists and opens the user profile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await signInAs(page, "user-alex");
  await page
    .getByRole("heading", { name: "Собираемся на баскет", exact: true })
    .getByRole("link")
    .click();
  const field = page.getByRole("textbox", {
    name: "Ваше сообщение",
    exact: true,
  });
  await field.fill("Привет @user-mar");
  await page
    .getByRole("listbox", { name: "Упомянуть пользователя" })
    .getByRole("option")
    .waitFor();
  await field.press("Enter");
  await expect(field).toHaveValue("Привет @user-maria ");
  await field.pressSequentially("Придёшь?");
  await page
    .getByRole("button", { name: "Отправить сообщение", exact: true })
    .click();
  const link = page
    .locator(".comment-text")
    .getByRole("link", { name: "@user-maria", exact: true });
  await expect(link).toBeVisible();
  const profileHref = await link.getAttribute("href");
  await page.reload();
  await link.click();
  await expect(page).toHaveURL(profileHref!);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Мария");
});
