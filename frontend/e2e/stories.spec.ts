import { test, expect, type Page } from "@playwright/test";

async function expectCentered(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(
    2,
  );
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(
    2,
  );
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  return box!;
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 1440, height: 1000 },
  { width: 844, height: 390 },
]) {
  test(`photo stories publish and fill a centered viewer at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("sport.mock.account", "admin");
    });
    await page.goto("/admin?section=stories");
    await expect(
      page.getByRole("heading", { name: "Истории", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Истории", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Новая история" });
    await expect(editor).toBeVisible();
    await expectCentered(page, ".story-editor-dialog");
    await expect(editor.getByRole("textbox")).toHaveCount(0);
    const publish = editor.getByRole("button", {
      name: "Опубликовать на 24 часа",
    });
    await expect(publish).toBeDisabled();
    const photo = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1280;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#ffcc16";
      context.fillRect(0, 0, 720, 1280);
      context.fillStyle = "#151419";
      context.fillRect(80, 80, 560, 1120);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const upload = editor.getByLabel("Изображение истории", { exact: true });
    await upload.setInputFiles({
      name: "invalid.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    });
    await expect(editor.getByRole("alert")).toContainText(
      "Выберите PNG или JPEG до 2 МБ",
    );
    await expect(publish).toBeDisabled();
    await upload.setInputFiles({
      name: "story.png",
      mimeType: "image/png",
      buffer: Buffer.from(photo, "base64"),
    });
    await expect(publish).toBeEnabled();
    const published = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/admin/stories") &&
        response.request().method() === "POST",
    );
    await publish.click();
    expect((await published).status()).toBe(201);
    await expect(editor).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Удалить историю 1", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "История 1 из 1. Не просмотрено",
        exact: true,
      })
      .click();
    const viewer = page.getByRole("dialog", {
      name: "История 1 из 1",
      exact: true,
    });
    await expect(viewer).toBeVisible();
    const image = viewer.getByRole("img", {
      name: "Фото истории",
      exact: true,
    });
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBe(720);
    await viewer.getByRole("button", { name: "Приостановить историю" }).click();
    const frame = await expectCentered(page, ".story-viewer-dialog");
    const imageBox = (await image.boundingBox())!;
    expect(Math.abs(frame.width / frame.height - 9 / 16)).toBeLessThan(0.01);
    for (const dimension of ["x", "y", "width", "height"] as const)
      expect(Math.abs(frame[dimension] - imageBox[dimension])).toBeLessThan(1);
    expect(
      await image.evaluate((element) => getComputedStyle(element).objectFit),
    ).toBe("cover");
    await expect(viewer.locator(".story-copy, time")).toHaveCount(0);
    await expect(viewer).not.toContainText("Стечение");
    await page.screenshot({
      path: `test-results/stories-${viewport.width}x${viewport.height}.png`,
    });
    await viewer.getByRole("button", { name: "Закрыть историю" }).click();
    await expect(viewer).not.toBeVisible();
    await page
      .getByRole("button", { name: "История 1 из 1. Просмотрено", exact: true })
      .click();
    await viewer
      .getByRole("button", { name: "Удалить историю", exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: "Удалить историю?",
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("Восстановить её не получится.");
    if (viewport.width === 375) {
      // Пока открыто предупреждение об удалении, восьмисекундный таймер сторис должен стоять на паузе.
      await page.waitForTimeout(8200);
      await expect(confirmation).toBeVisible();
    }
    await confirmation
      .getByRole("button", { name: "Отмена", exact: true })
      .click();
    await expect(confirmation).not.toBeVisible();
    await expect(viewer).toBeVisible();
    await viewer
      .getByRole("button", { name: "Удалить историю", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(confirmation).not.toBeVisible();
    await expect(viewer).toBeVisible();
    await expect(page.locator(".story-bubble:not(.story-add)")).toHaveCount(1);
    await viewer
      .getByRole("button", { name: "Удалить историю", exact: true })
      .click();
    await confirmation
      .getByRole("button", { name: "Удалить", exact: true })
      .click();
    await expect(viewer).not.toBeVisible();
    await expect(page.locator(".story-bubble:not(.story-add)")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
}
