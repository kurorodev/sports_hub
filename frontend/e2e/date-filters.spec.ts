import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1440]) {
  test(`catalog and map reject past and reversed date filters at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date("2026-10-19T22:30:00Z"));
    await page.context().route(/^https:\/\//, (route) => route.abort());
    for (const path of ["/", "/map"]) {
      await page.goto(path);
      if (path === "/map")
        await page.getByText("Даты встреч (UTC)", { exact: true }).click();
      const from = page.getByLabel("Дата от (UTC)");
      const to = page.getByLabel("Дата до (UTC)");
      await expect(from).toHaveAttribute("min", "2026-10-19");
      await expect(to).toHaveAttribute("min", "2026-10-19");
      await from.fill("2026-10-18");
      await expect(from).toHaveValue("");
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Выберите сегодняшнюю или будущую дату" }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.has("from")).toBe(false);
      await from.fill("2026-10-19");
      await expect(from).toHaveValue("2026-10-19");
      await from.fill("2026-10-21");
      await expect(to).toHaveAttribute("min", "2026-10-21");
      await to.fill("2026-10-20");
      await expect(to).toHaveValue("");
      expect(new URL(page.url()).searchParams.has("to")).toBe(false);
      await to.fill("2026-10-21");
      await expect(to).toHaveValue("2026-10-21");
      await from.fill("2026-10-22");
      await expect(from).toHaveValue("2026-10-21");
      expect(new URL(page.url()).searchParams.get("from")).toBe("2026-10-21");
      await from.fill("");
      await to.fill("");
      await expect(to).toHaveAttribute("min", "2026-10-19");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
}
