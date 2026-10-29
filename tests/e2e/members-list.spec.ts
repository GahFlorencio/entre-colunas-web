import { test, expect } from "@playwright/test";

test("members filters search every page, preserve drafts and fit both themes", async ({
  page,
}) => {
  const members = Array.from({ length: 21 }, (_, i) => ({
    id: String(i + 1),
    name:
      i === 20
        ? "José Antônio de Albuquerque Nome Muito Longo"
        : `Membro ${i + 1}`,
    phone: "11999999999",
    agape_participant: true,
    status: { id: "1", slug: "ativo", label: "Ativo" },
  }));
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "entre-colunas.web.session",
      JSON.stringify({
        token: "test",
        lodgeId: "12",
        expiresAt: Date.now() + 3600000,
      }),
    ),
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/me"))
      return route.fulfill({
        json: {
          user: {
            id: "1",
            name: "Ana",
            email: "ana@example.com",
            lodges: [
              {
                id: "12",
                label: "Loja de teste",
                number: "1",
                masonic_authority: { id: "1", label: "GLE", name: "GLE" },
              },
            ],
          },
        },
      });
    if (url.pathname.endsWith("/member-statuses"))
      return route.fulfill({
        json: [{ id: "1", slug: "ativo", label: "Ativo", active: true }],
      });
    if (url.pathname.endsWith("/members")) {
      const current = Number(url.searchParams.get("page") || 1);
      // Deliberately cap server pages to verify the search follows pagination.
      return route.fulfill({
        json: {
          results: members.slice((current - 1) * 20, current * 20),
          total: 21,
          page: current,
          per_page: 20,
        },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("/membros");
  await expect(page.getByText("21 cadastrados")).toBeVisible();
  await page.getByRole("button", { name: "Filtrar membros" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("jose antonio");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByText("1 encontrados")).toBeVisible();
  await expect(page.getByRole("link", { name: /José Antônio/ })).toBeVisible();
  await page.getByRole("button", { name: "Filtrar membros" }).click();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("1 encontrados")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Filtrar membros" }),
  ).toBeFocused();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 420 });
      const closeMenu = page.getByRole("button", {
        name: "Fechar menu",
        exact: true,
      });
      if (await page.locator(".sidebar.opened").count()) await closeMenu.click();
      await page.getByRole("button", { name: "Filtrar membros" }).click();
      const modal = page.getByRole("dialog");
      const box = await modal.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(12);
      expect(Math.abs(box!.x - (width - box!.x - box!.width))).toBeLessThan(2);
      const input = await page
        .getByLabel("Nome", { exact: true })
        .boundingBox();
      expect(input!.width).toBeGreaterThan(box!.width - 60);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `test-results/members-${theme}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await page.screenshot({
        path: `test-results/members-list-${theme}-${width}.png`,
      });
    }
  }
});
