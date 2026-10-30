import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function setup(page: Page) {
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
  const writes: {
    path: string;
    body: Record<string, unknown>;
    key: string | undefined;
  }[] = [];
  let fail = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
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
                label:
                  "Loja de testes com identificação extensa para o relatório",
                number: "1",
                masonic_authority: { id: "1", label: "GLE", name: "GLE" },
              },
            ],
          },
        },
      });
    if (url.pathname.includes("/cash/")) {
      if (request.method() === "POST") {
        writes.push({
          path: url.pathname,
          body: request.postDataJSON(),
          key: request.headers()["idempotency-key"],
        });
        return route.fulfill({ json: { id: "3", ...request.postDataJSON() } });
      }
      if (fail)
        return route.fulfill({
          status: 500,
          json: { error: "Consulta indisponível" },
        });
      const cash = url.pathname.includes("/agape/") ? "agape" : "hospitalaria";
      const report = url.pathname.endsWith("/report");
      const results = Array.from({ length: report ? 80 : 2 }, (_, i) => ({
        id: String(i + 1),
        kind: i === 0 && !url.searchParams.get("kind") ? "transfer" : "expense",
        direction:
          i === 0 && !url.searchParams.get("kind") ? "credit" : "debit",
        value: i === 0 ? 1234567.89 : 125.31,
        description:
          i === 0
            ? "Transferência manual para despesas independentes com descrição extensa preservada integralmente"
            : "Compra de alimentos e materiais para atendimento com descrição longa e detalhada " +
              i,
        occurred_on: i % 2 === 0 ? "2026-10-30" : "2026-10-29",
        created_at: "2026-10-30T12:00:00Z",
        lodge_operation_id: i === 0 ? "12" : null,
      }));
      return route.fulfill({
        json: {
          cash,
          balance: cash === "agape" ? 1234567.89 : 99,
          revision: "2",
          can_open: true,
          totals: {
            credits:
              results.reduce(
                (sum, e) =>
                  sum + (e.kind === "expense" ? 0 : Math.round(e.value * 100)),
                0,
              ) / 100,
            expenses:
              results.reduce(
                (sum, e) =>
                  sum + (e.kind === "expense" ? Math.round(e.value * 100) : 0),
                0,
              ) / 100,
          },
          results,
          total: report ? 80 : 2,
          page: Number(url.searchParams.get("page") || 1),
          per_page: report ? 80 : 20,
          generated_at: "2026-10-30T12:00:00Z",
        },
      });
    }
    return route.fulfill({ json: { results: [], total: 0 } });
  });
  return {
    writes,
    setFail: () => {
      fail = true;
    },
  };
}
test("independent boxes, manual expense and transfer, filter drafts and complete PDF", async ({
  page,
}, testInfo) => {
  const { writes } = await setup(page);
  await page.goto("/caixas/agape");
  await expect(
    page.getByRole("heading", { name: "Ágape", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("R$ 1.234.567,89", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Alimentos");
  await page.getByLabel("Valor total (R$)").fill("25,31");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Movimentação registrada." }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]!.body).toMatchObject({
    kind: "expense",
    value: 25.31,
    description: "Alimentos",
  });
  expect(writes[0]!.key).toBeTruthy();
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Operação", exact: true })
    .selectOption("transfer");
  await expect(
    page.getByText("Debita o caixa da loja e credita Ágape. Repasse manual."),
  ).toBeVisible();
  await page.getByLabel("Descrição", { exact: true }).fill("Repasse manual");
  await page.getByLabel("Valor total (R$)").fill("100");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[1]!.body.kind).toBe("transfer");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Mostrar", exact: true })
    .selectOption("expense");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Filtros", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".cash-context")).toContainText(
    "Entradas e despesas",
  );
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Mostrar", exact: true })
    .selectOption("expense");
  await page.getByLabel("De", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Até", { exact: true }).fill("2026-10-31");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.locator(".cash-context")).toContainText("Somente despesas");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await mkdir("/tmp/auxiliary-cash-qa", { recursive: true });
  await (
    await download
  ).saveAs(`/tmp/auxiliary-cash-qa/despesas-${testInfo.project.name}.pdf`);
  await page.getByRole("link", { name: "Hospitalaria", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hospitalaria", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("R$ 99,00", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
});
test("responsive ledger and centered modal in both themes, including short viewport", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.goto("/caixas/agape");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [768, 900],
      [1024, 900],
      [1440, 1000],
      [390, 420],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      await expect(page.locator(".ledger-entry").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const title = page.locator(".ledger-title").first();
      expect(
        await title.evaluate((e) => e.scrollHeight <= e.clientHeight),
      ).toBe(true);
      await page.getByRole("button", { name: "Filtros", exact: true }).click();
      const box = await page.getByRole("dialog").boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.x - (width! - box!.x - box!.width))).toBeLessThan(3);
      const field = await page.getByLabel("De", { exact: true }).boundingBox();
      expect(field!.width).toBeGreaterThan(box!.width - 100);
      await page
        .getByRole("button", { name: "Aplicar filtros" })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Aplicar filtros" }),
      ).toBeInViewport();
      if (testInfo.project.name === "desktop") {
        await mkdir("/tmp/auxiliary-cash-qa", { recursive: true });
        await page.screenshot({
          path: `/tmp/auxiliary-cash-qa/modal-${theme}-${width}-${height}.png`,
        });
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Filtros", exact: true }),
      ).toBeFocused();
      if (testInfo.project.name === "desktop")
        await page.screenshot({
          path: `/tmp/auxiliary-cash-qa/ledger-${theme}-${width}-${height}.png`,
        });
    }
  }
});
test("failed query is not displayed as zero balance or empty ledger", async ({
  page,
}) => {
  const state = await setup(page);
  state.setFail();
  await page.goto("/caixas/agape");
  await expect(page.getByRole("alert")).toContainText("Consulta indisponível");
  await expect(page.locator(".cash-summary")).toHaveCount(0);
  await expect(
    page.getByText("Nenhuma movimentação nos filtros aplicados."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "PDF", exact: true }),
  ).toBeDisabled();
});

test("does not download an old report after changing cash boxes", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/cash/agape/report?*", async (route) => {
    requested();
    await pending;
    await route.fulfill({
      json: {
        cash: "agape",
        balance: 0,
        revision: "0",
        can_open: true,
        totals: { credits: 0, expenses: 0 },
        results: [],
        total: 0,
        page: 1,
        per_page: 0,
        generated_at: "2026-10-30T12:00:00Z",
      },
    });
  });
  const downloads: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  await page.goto("/caixas/agape");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await started;
  await page.getByRole("link", { name: "Hospitalaria", exact: true }).click();
  await expect(page.getByText("R$ 99,00", { exact: true })).toBeVisible();
  const finished = page.waitForResponse("**/cash/agape/report?*");
  release();
  await finished;
  await expect(
    page.getByRole("button", { name: "PDF", exact: true }),
  ).toBeEnabled();
  expect(downloads).toEqual([]);
});
