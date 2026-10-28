import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { periodReport } from "../fixtures/period-report";
async function setup(
  page: Page,
  options: {
    closed?: boolean;
    failed?: boolean;
    long?: boolean;
    empty?: boolean;
    stressIndividual?: boolean;
    general?: boolean;
  } = {},
) {
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
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace(/^\/api/, "");
    const send = (json: unknown, status = 200) =>
      route.fulfill({ json, status });
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
    const addition = options.closed
      ? 5
      : Number(url.searchParams.get("acrescimo") || 0);
    let expenses = options.empty
      ? []
      : options.long
        ? Array.from({ length: 75 }, (_, i) => ({
            ...periodReport.expenses[i % 3],
            expense_id: String(i + 1),
            description: `Despesa ${i + 1} - Manutenção e conservação das instalações`,
          }))
        : periodReport.expenses;
    if (options.stressIndividual)
      expenses = expenses.map((e) =>
        e.type === "individual"
          ? {
              ...e,
              description:
                "Compra individual de materiais para cerimônia e atividades do membro no período",
              category: "CategoriaIndividualSemEspacos".repeat(5),
              total_value: 22.5,
              installments_count: 3,
            }
          : e,
      );
    if (options.general)
      expenses = [
        ...expenses,
        {
          ...periodReport.expenses[0]!,
          expense_id: "99",
          description: "Despesa geral da loja",
          type: "geral",
          installment_number: 1,
          installments_count: 1,
          total_value: 30,
          value: 30,
          allocated_value: 0,
          divisor: 0,
          allocation: "Não cobrada dos membros",
        },
      ];
    const report = {
      ...periodReport,
      status: options.closed ? "closed" : "open",
      closed_at: options.closed ? "2026-10-28T12:00:00Z" : null,
      acrescimo: addition,
      expenses,
      total_expenses:
        expenses.reduce((sum, e) => sum + Math.round(e.value * 100), 0) / 100,
      total_charges:
        Math.round((periodReport.total_charges + 3 * addition) * 100) / 100,
      groups: periodReport.groups.map((g) =>
        g.key === "away"
          ? g
          : {
              ...g,
              total_charges:
                Math.round(
                  (g.total_charges + g.member_count * addition) * 100,
                ) / 100,
              min_charge: Math.round((g.min_charge + addition) * 100) / 100,
              max_charge: Math.round((g.max_charge + addition) * 100) / 100,
            },
      ),
    };
    if (path.endsWith("/81/report"))
      return options.failed
        ? send({ error: "Valores financeiros indisponíveis" }, 503)
        : send(report);
    if (path.endsWith("/periods/81"))
      return send({
        ...report,
        id: "81",
        masonic_lodge_id: "8",
        captured_members: 4,
        statements_count: options.closed ? 1 : 0,
        closing_contribution_value: options.closed ? 50 : null,
        closing_agape_value: options.closed ? 20 : null,
        members: [
          {
            member_id: "1",
            member_name: "Membro capturado",
            member_status_slug: "ativo",
            agape_participant: true,
            captured_at: report.opened_at,
          },
        ],
      });
    return send({ results: [], total: 0, page: 1, per_page: 20 });
  });
  await page.goto("/periodos/81");
}
for (const closed of [false, true]) {
  test(`shows allocation and increment in ${closed ? "closed" : "open"} statement and PDF`, async ({
    page,
  }, info) => {
    await setup(page, { closed });
    const region = page.getByRole("region", { name: "Despesas do período" });
    if (!closed) {
      await page
        .getByLabel("Acréscimo por membro ativo (R$)", { exact: true })
        .fill("5");
    }
    await expect(
      page
        .getByRole("article", { name: "Ativos com ágape", exact: true })
        .locator(".period-charge"),
    ).toContainText(/118,33.*125,83/);
    await expect(
      page
        .getByRole("article", { name: "Afastados", exact: true })
        .locator(".period-charge"),
    ).toContainText(/10,00/);
    await page.getByRole("tab", { name: "Extrato", exact: true }).click();
    const row = region
      .getByRole("row")
      .filter({ hasText: "Acréscimo por membro ativo" });
    await expect(row).toContainText(/15,00/);
    await expect(row).toContainText(/5,00/);
    await expect(row).toContainText("3 membros");
    await expect(row.getByRole("link")).toHaveCount(0);
    await expect(region).toContainText(/162,50/);
    const expense = region
      .getByRole("row")
      .filter({ hasText: "Manutenção do templo" });
    for (const value of [/300,00/, /100,00/, /33,33/])
      await expect(expense).toContainText(value);
    const individual = region
      .getByRole("row")
      .filter({ hasText: "Material individual" });
    await expect(individual.locator(".expense-context")).toContainText(
      "Individual",
    );
    await expect(individual).toContainText(/7,50/);
    await expect(individual.getByRole("link")).toHaveAttribute(
      "href",
      "/despesas/12",
    );
    await expect(
      page.getByText("Despesa geral da loja", { exact: true }),
    ).toHaveCount(0);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PDF" }).click();
    const pdf = await download;
    expect(pdf.suggestedFilename()).toBe(
      `periodo-3-${closed ? "fechado" : "previa"}.pdf`,
    );
    const file = `/tmp/period-report-increment-${closed ? "closed" : "open"}-${info.project.name}.pdf`;
    await pdf.saveAs(file);
    expect((await readFile(file)).subarray(0, 4).toString()).toBe("%PDF");
    await page.screenshot({
      path: `/tmp/period-report-increment-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("tab", { name: "Membros", exact: true }).click();
    if (closed) {
      await expect(
        page.getByRole("heading", { name: "Demonstrativos dos membros" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Quadro capturado na abertura" }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("heading", { name: "Quadro capturado na abertura" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Demonstrativos dos membros" }),
      ).toHaveCount(0);
    }
    await expect(
      page.getByRole("heading", { name: "Extrato de despesas" }),
    ).toBeHidden();
    if (!closed) {
      await page.getByRole("button", { name: "Revisar fechamento" }).click();
      await expect(
        page
          .getByRole("dialog")
          .getByLabel("Acréscimo por membro ativo (R$)", { exact: true }),
      ).toHaveValue("5");
    }
  });
}
test("shows an increment even without expense rows", async ({ page }) => {
  await setup(page, { empty: true });
  await page
    .getByLabel("Acréscimo por membro ativo (R$)", { exact: true })
    .fill("5");
  await page.getByRole("tab", { name: "Extrato", exact: true }).click();
  const region = page.getByRole("region", { name: "Despesas do período" });
  await expect(region).toContainText("Acréscimo por membro ativo");
  await expect(region).toContainText(/15,00/);
});
test("disables PDF and avoids invented totals when the report is unavailable", async ({
  page,
}) => {
  await setup(page, { failed: true });
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
  ).toBeDisabled();
  await expect(page.getByText(/valores financeiros/i).first()).toBeVisible();
});
test("exports the complete long statement", async ({ page }, info) => {
  await setup(page, { closed: true, long: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await (
    await download
  ).saveAs(`/tmp/period-report-long-${info.project.name}.pdf`);
});

for (const width of [320, 390, 768]) {
  test(`compact period stays readable at ${width}px in light and dark themes`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page, { closed: true });
    await expect(
      page.getByRole("article", { name: "Ativos com ágape", exact: true }),
    ).toBeVisible();
    const cardsHeight = await page
      .locator(".period-cards")
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(cardsHeight).toBeLessThan(220);
    const cards = page.getByRole("article");
    const positions = await cards.evaluateAll((elements) =>
      elements.map((el) => ({
        y: el.getBoundingClientRect().y,
        width: el.getBoundingClientRect().width,
      })),
    );
    expect(positions[1].y).toBe(positions[2].y);
    expect(positions[0].width).toBeGreaterThan(positions[1].width);
    const metadata = page.locator(".period-metadata");
    await expect(metadata).toBeVisible();
    await expect(metadata.locator("summary")).toHaveCount(0);
    const detailsBottom = await metadata.evaluate(
      (el) => el.getBoundingClientRect().bottom,
    );
    const cardsTop = await page
      .locator(".period-cards")
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(detailsBottom).toBeLessThanOrEqual(cardsTop);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page
          .getByRole("button", { name: "Ativar tema escuro", exact: true })
          .click();
      await page.getByRole("tab", { name: "Visão Geral", exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/period-overview-${width}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
      await page.getByRole("tab", { name: "Extrato", exact: true }).click();
      await expect(page.locator(".period-cards")).toBeHidden();
      await expect(metadata).toBeHidden();
      const region = page.getByRole("region", { name: "Despesas do período" });
      expect(
        await region.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/period-compact-${width}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  });
}

test("period tabs support keyboard navigation and preserve the increment", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByLabel("Acréscimo por membro ativo (R$)", { exact: true })
    .fill("5");
  const overview = page.getByRole("tab", { name: "Visão Geral", exact: true });
  await overview.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Extrato", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("region", { name: "Despesas do período" }),
  ).toContainText("Acréscimo por membro ativo");
  await page.getByRole("tab", { name: "Extrato", exact: true }).press("End");
  await expect(
    page.getByRole("heading", { name: "Quadro capturado na abertura" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Membros", exact: true }).press("Home");
  await expect(
    page.getByLabel("Acréscimo por membro ativo (R$)", { exact: true }),
  ).toHaveValue("5");
  await expect(
    page.getByRole("button", { name: "Exportar PDF" }),
  ).toBeEnabled();
});

for (const width of [320, 390, 1440]) {
  test(`individual expense stays aligned with long descriptions at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, { closed: true, stressIndividual: true });
    await page.getByRole("tab", { name: "Extrato", exact: true }).click();
    const region = page.getByRole("region", { name: "Despesas do período" });
    const row = region
      .getByRole("row")
      .filter({ hasText: "Compra individual de materiais" });
    await expect(row.locator(".expense-kind")).toHaveText("Individual");
    await expect(row).toContainText(/22,50/);
    await expect(row).toContainText(/7,50/);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page
          .getByRole("button", { name: "Ativar tema escuro", exact: true })
          .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await region.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect(
        await row
          .locator(".expense-context")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/individual-layout-${width}-${theme}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  });
}

for (const closed of [false, true]) {
  test(`general expenses have zero member charge (${closed ? "closed" : "open"})`, async ({
    page,
  }, info) => {
    await setup(page, { closed, general: true });
    await page.getByRole("tab", { name: "Extrato", exact: true }).click();
    const row = page
      .getByRole("row")
      .filter({ hasText: "Despesa geral da loja" });
    await expect(row).toContainText("Geral");
    await expect(row).toContainText("30,00");
    await expect(row.locator(".allocated-amount")).toContainText("0,00");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar PDF" }).click();
    await (
      await download
    ).saveAs(
      `/tmp/period-general-${closed ? "closed" : "open"}-${info.project.name}.pdf`,
    );
  });
}
