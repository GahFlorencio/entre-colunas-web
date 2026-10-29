import { test, expect } from "@playwright/test";
test("despesas compactas e PDF inclui todas as páginas filtradas", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "entre-colunas.web.session",
      JSON.stringify({
        token: "session",
        lodgeId: "8",
        expiresAt: Date.now() + 3600000,
      }),
    ),
  );
  const requested: number[] = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace(/^\/api/, "");
    const send = (json: unknown) => route.fulfill({ json });
    if (path === "/me")
      return send({
        user: {
          id: "5",
          name: "Ana",
          email: "ana@example.com",
          is_admin: false,
          lodges: [
            {
              id: "8",
              label: "União e Fraternidade",
              number: "123",
              masonic_authority: { id: "1", label: "GLE", name: "Grande Loja" },
            },
          ],
        },
      });
    const p = Number(url.searchParams.get("page") || 1),
      size = Number(url.searchParams.get("per_page") || 20);
    if (path.endsWith("/financial/summary"))
      return send({
        masonic_lodge_id: "8",
        cash_balance: 500,
        unpaid_expenses_total: 9876543.21,
        accounts_receivable_total: 0,
        calculated_at: "2026-10-29T12:00:00Z",
      });
    if (path.endsWith("/members") || path.endsWith("/financial/periods"))
      return send({ results: [], total: 0, page: p, per_page: size });
    if (path.endsWith("/expense/type"))
      return send([{ id: "1", label: "Rateio", slug: "rateio" }]);
    if (path.endsWith("/expense/category"))
      return send({
        results: [
          {
            id: "2",
            label: "Manutenção",
            slug: "manutencao",
            active: true,
            scope: "lodge",
          },
        ],
        total: 1,
        page: p,
        per_page: size,
      });
    if (path.endsWith("/expense")) {
      if (size === 100) requested.push(p);
      const rows = Array.from({ length: 105 }, (_, i) => ({
        id: String(i + 1),
        label: `Despesa ${i + 1} · Manutenção e conservação das instalações`,
        masonic_lodge_id: "8",
        financial_period_id: "1",
        total_value: 100.25,
        parcels: 2,
        expense_type_slug: "rateio",
        expense_category_slug: "manutencao",
        expense_category_id: "2",
        expense_type_id: "1",
        ratio_to_all: false,
        owner_expense_member_id: null,
        payed: false,
        status: "active",
        programming_version: 1,
        installments: [],
      }));
      return send({
        results: rows.slice((p - 1) * size, p * size),
        total: rows.length,
        page: p,
        per_page: size,
      });
    }
    return send([]);
  });
  await page.goto("/despesas");
  await expect(page.getByText("105 registros")).toBeVisible();
  await expect(page.locator(".expense-total strong")).toHaveText(
    /9.876.543,21/,
  );
  await expect(page.locator(".ledger-entry")).toHaveCount(20);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(300);
      expect(
        await page
          .locator(".expense-list")
          .evaluate((el) => el.getBoundingClientRect().right),
      ).toBeLessThanOrEqual(width);
      const row = page.locator(".ledger-entry").first();
      const title = await row.locator(".ledger-copy").boundingBox();
      const amount = await row.locator(".ledger-value").boundingBox();
      expect(title).not.toBeNull();
      expect(amount).not.toBeNull();
      if (width < 600) {
        expect(amount!.y).toBeGreaterThan(title!.y);
        expect(amount!.x).toBeCloseTo(title!.x, 0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/expenses-${theme}-${width}-${testInfo.project.name}.png`,
      });
    }
  }
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.getByLabel("Situação", { exact: true }).selectOption("cancelled");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await expect(page.getByLabel("Situação", { exact: true })).toHaveValue("");
  await page.setViewportSize({ width: 320, height: 420 });
  await page
    .getByRole("button", { name: "Membro: Todos", exact: true })
    .click();
  const search = page.getByRole("searchbox", { name: "Buscar membro" });
  await expect(search).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aplicar filtros" }),
  ).not.toBeVisible();
  const searchBox = await search.boundingBox();
  const listBox = await page.locator(".selector-options").boundingBox();
  expect(searchBox!.width).toBeCloseTo(listBox!.width, 0);
  expect(listBox!.height).toBeGreaterThan(44);
  await search.press("Enter");
  await expect(search).toBeVisible();
  await search.press("Escape");
  await expect(
    page.getByRole("button", { name: "Membro: Todos", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `/tmp/expenses-filters-short-${testInfo.project.name}.png`,
  });
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByText("Valor original").first()).toBeVisible();
  await expect(page.getByLabel("Situação", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "A pagar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "A pagar", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar despesas em PDF" }).click(),
  ]);
  await download.saveAs(`/tmp/expenses-report-${testInfo.project.name}.pdf`);
  expect(requested).toEqual([1, 2]);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/expenses-${testInfo.project.name}.png`,
    fullPage: false,
  });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  await page.getByText("Filtros", { exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/expenses-dark-${testInfo.project.name}.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  let failedDownload = false;
  page.on("download", () => {
    failedDownload = true;
  });
  await page.route("**/api/**/expense?**", (route) => {
    const url = new URL(route.request().url());
    if (
      url.searchParams.get("page") === "2" &&
      url.searchParams.get("per_page") === "100"
    )
      return route.fulfill({
        status: 500,
        json: { message: "Falha de leitura" },
      });
    return route.fallback();
  });
  await page.getByRole("button", { name: "Exportar despesas em PDF" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exportar despesas em PDF" }),
  ).toBeEnabled();
  expect(failedDownload).toBe(false);
});
