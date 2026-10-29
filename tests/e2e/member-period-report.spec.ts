import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { memberPeriodReport } from "../fixtures/member-period-report";

async function setup(
  page: Page,
  options: {
    closed?: boolean;
    count?: number;
    failed?: boolean;
    inconsistent?: boolean;
    delay?: number;
  } = {},
) {
  const report = memberPeriodReport(options.closed ?? true, options.count ?? 5);
  let fail = !!options.failed;
  let requests = 0;
  let writes = 0;
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
    const path = url.pathname;
    if (route.request().method() !== "GET") writes++;
    if (path.endsWith("/me"))
      return route.fulfill({
        json: {
          user: {
            id: "1",
            name: "Ana",
            email: "ana@example.com",
            lodges: [
              {
                id: "12",
                label: "União e Fraternidade",
                number: "998",
                masonic_authority: { id: "1", label: "GLE", name: "GLE" },
              },
            ],
          },
        },
      });
    if (path.endsWith("/members/21/report")) {
      requests++;
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      return fail
        ? route.fulfill({
            status: 500,
            json: { message: "Falha ao consultar o demonstrativo" },
          })
        : route.fulfill({
            json: {
              ...report,
              ...(options.inconsistent ? { total_charges: 999 } : {}),
            },
          });
    }
    if (path.endsWith("/member/21"))
      return route.fulfill({
        json: {
          id: "21",
          name: report.member_name,
          phone: "11999999999",
          lodge_beggin: report.opened_at,
          agape_participant: true,
          status: { id: "1", slug: "ativo", label: "Ativo" },
        },
      });
    if (path.endsWith("/financial/account"))
      return route.fulfill({
        json: { id: "1", type: "member", member_id: "21", balance: -50 },
      });
    if (path.endsWith("/movements"))
      return route.fulfill({
        json: {
          results: [],
          total: 0,
          page: 1,
          per_page: 20,
          balance: -50,
          account_type: "member",
          member_id: "21",
          totals: {},
        },
      });
    if (path.endsWith("/periods"))
      return route.fulfill({
        json: {
          results: [
            {
              id: "81",
              masonic_lodge_id: "12",
              sequence: 10,
              status: report.status,
              opened_at: report.opened_at,
              closed_at: report.closed_at,
            },
          ],
          total: 1,
          page: 1,
          per_page: 10,
        },
      });
    return route.fulfill({ json: {} });
  });
  return {
    report,
    setFailure: (value: boolean) => {
      fail = value;
    },
    requests: () => requests,
    writes: () => writes,
  };
}
for (const closed of [false, true]) {
  test(`member period ${closed ? "closed" : "open"} shares total, approved ledger and complete PDF`, async ({
    page,
  }, info) => {
    const state = await setup(page, { closed, count: 65 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/membros/21?aba=periodos");
    const previous = page.getByRole("link", { name: /Período 10/ });
    await expect(previous).toContainText("2.155,79");
    await previous.click();
    await expect(
      page.getByRole("heading", { name: "Período 10", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".member-period-total strong")).toHaveText(
      /2.155,79/,
    );
    await expect(page.locator(".ledger-entry")).toHaveCount(20);
    await expect(page.locator(".ledger-meta").first()).toHaveText(
      closed ? "28/10/2026 · Contribuição" : "Contribuição",
    );
    await expect(page.locator(".ledger-entry").first()).toHaveJSProperty(
      "tagName",
      closed ? "A" : "DIV",
    );
    await page.getByRole("button", { name: "Próxima" }).click();
    await expect(page.locator(".ledger-entry").first()).toContainText(
      "Contribuição mensal 21",
    );
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 420 });
        if (await page.locator(".sidebar.opened").count())
          await page
            .getByRole("button", { name: "Fechar menu", exact: true })
            .click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await page.screenshot({
          path: `test-results/member-period-${closed}-${theme}-${width}-${info.project.name}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    const requestCount = state.requests();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    const pdf = await download;
    const file = `/tmp/member-period-${closed ? "closed" : "open"}-${info.project.name}.pdf`;
    await pdf.saveAs(file);
    const text = execFileSync("pdftotext", ["-layout", file, "-"]).toString();
    expect(text).toContain("2.155,79");
    expect(text).toContain("Contribuição mensal 1 -");
    expect(text).toContain("Acréscimo uniforme 65 -");
    expect(text).toContain("Despesa individual do membro 4");
    expect(text).toContain(closed ? "FECHADO" : "PRÉVIA");
    expect(text.match(/Página \d+ de/g)!.length).toBeGreaterThan(1);
    expect(state.requests()).toBe(requestCount);
    expect(state.writes()).toBe(0);
    expect(errors).toEqual([]);
    await page.getByRole("link", { name: "Períodos do membro" }).click();
    await expect(page.getByRole("tab", { name: "Períodos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("link", { name: /Período 10/ })).toContainText(
      "2.155,79",
    );
  });
}
test("failed totals remain unavailable, retry succeeds and incomplete report cannot export", async ({
  page,
}) => {
  const state = await setup(page, { failed: true });
  await page.goto("/membros/21?aba=periodos");
  await expect(page.getByText("Total indisponível")).toBeVisible();
  state.setFailure(false);
  await page
    .getByRole("button", { name: "Atualizar totais dos períodos" })
    .click();
  await expect(page.getByRole("link", { name: /Período 10/ })).toContainText(
    "165,83",
  );
  state.setFailure(true);
  await page.getByRole("link", { name: /Período 10/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PDF", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".member-period-total")).toHaveCount(0);
  state.setFailure(false);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator(".member-period-total strong")).toContainText(
    "165,83",
  );
});
test("inconsistent report is rejected before display or PDF", async ({
  page,
}) => {
  await setup(page, { inconsistent: true });
  await page.goto("/membros/21/periodos/81");
  await expect(page.getByRole("alert")).toContainText("inconsistente");
  await expect(
    page.getByRole("button", { name: "PDF", exact: true }),
  ).toHaveCount(0);
});

test("compact report and previous totals fit both themes at every supported width", async ({
  page,
}, info) => {
  await setup(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await page.goto("/membros/21?aba=periodos");
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      if (await page.locator(".sidebar.opened").count())
        await page
          .getByRole("button", { name: "Fechar menu", exact: true })
          .click();
      const link = page.getByRole("link", { name: /Período 10/ });
      await expect(link).toContainText("165,83");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      const total = (await link.locator(".period-total strong").boundingBox())!;
      const row = (await link.boundingBox())!;
      expect(total.x).toBeGreaterThanOrEqual(row.x);
      expect(total.x + total.width).toBeLessThanOrEqual(row.x + row.width);
      await page.screenshot({
        path: `test-results/member-period-list-${theme}-${width}-${info.project.name}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await link.click();
      await expect(page.locator(".ledger-entry")).toHaveCount(5);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `test-results/member-period-compact-${theme}-${width}-${info.project.name}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
});
