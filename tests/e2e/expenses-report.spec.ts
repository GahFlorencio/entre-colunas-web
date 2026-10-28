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
