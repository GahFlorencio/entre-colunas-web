import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`startup preserves ${theme} appearance while modules load`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      theme,
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/src/main.ts*", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/login", { waitUntil: "commit" });
    try {
      await expect(
        page.getByRole("status", { name: "Preparando aplicativo" }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByText("Carregando Entre Colunas…")).toHaveCount(0);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(page.locator(".boot")).toBeVisible();
        await page.screenshot({
          path: `test-results/startup-${theme}-${width}.png`,
        });
      }
    } finally {
      release();
    }
    await expect(
      page.getByRole("heading", { name: "Acesse sua conta" }),
    ).toBeVisible();
    await expect(page.locator(".boot")).toHaveCount(0);
  });
}
