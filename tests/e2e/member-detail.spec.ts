import { test, expect } from "@playwright/test";

test("member detail separates content and preserves date filter drafts on small screens", async ({
  page,
}) => {
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
  let fail = false;
  let balance = -1234567.89;
  let memberStatus = { id: "1", slug: "ativo", label: "Ativo" };
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
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
                label: "Loja de teste",
                number: "1",
                masonic_authority: { id: "1", label: "GLE", name: "GLE" },
              },
            ],
          },
        },
      });
    if (path.endsWith("/member/21"))
      return route.fulfill({
        json: {
          id: "21",
          name: "José Antônio de Albuquerque Nome Muito Longo",
          phone: "11999999999",
          lodge_beggin: "2020-01-01",
          agape_participant: true,
          status: memberStatus,
        },
      });
    if (path.endsWith("/financial/account"))
      return fail
        ? route.fulfill({
            status: 500,
            json: { message: "Saldo indisponível" },
          })
        : route.fulfill({
            json: { type: "member", member_id: "21", id: "1", balance },
          });
    if (path.endsWith("/movements"))
      return fail
        ? route.fulfill({
            status: 500,
            json: { message: "Consulta indisponível" },
          })
        : route.fulfill({
            json: {
              results: [
                {
                  id: "1",
                  financial_operation_id: "1",
                  financial_period_id: "1",
                  direction: "credit",
                  value: 1234567.89,
                  description:
                    "Pagamento com descrição muito longa para testar a leitura completa no celular",
                  category_label: "Contribuição mensal",
                  operation_type: "member_payment",
                  created_at: "2026-10-01",
                },
                {
                  id: "2",
                  financial_operation_id: "2",
                  financial_period_id: "1",
                  direction: "debit",
                  value: 185.5,
                  description: "Mensalidade de outubro",
                  category_label: "Mensalidade",
                  operation_type: "period_close",
                  created_at: "2026-10-01T14:00:00Z",
                },
                {
                  id: "3",
                  financial_operation_id: "3",
                  financial_period_id: "1",
                  direction: "credit",
                  value: 50,
                  description: "Pagamento via Pix",
                  category_label: null,
                  operation_type: "member_payment",
                  created_at: "2026-09-28T14:00:00Z",
                },
              ],
              total: 3,
              page: 1,
              per_page: 20,
              balance: 1234567.89,
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
              id: "1",
              masonic_lodge_id: "12",
              sequence: 10,
              status: "open",
              opened_at: "2026-10-01",
              closed_at: null,
            },
            {
              id: "2",
              masonic_lodge_id: "12",
              sequence: 9,
              status: "closed",
              opened_at: "2026-09-01T12:00:00Z",
              closed_at: "2026-09-30T12:00:00Z",
            },
          ],
          total: 2,
          page: 1,
          per_page: 10,
        },
      });
    return route.fulfill({ json: {} });
  });
  await page.goto("/membros/21");
  await expect(
    page.getByRole("heading", { name: /José Antônio/ }),
  ).toBeVisible();
  await expect(page.getByText("Saldo atual", { exact: true })).toBeVisible();
  await expect(page.locator(".member-payable strong")).toHaveText(
    /1.234.567,89/,
  );
  await expect(page.locator(".member-balance strong")).toHaveClass(
    "amount-debt",
  );
  await expect(page.locator(".member-payable strong")).toHaveClass(
    "amount-debt",
  );
  await expect(
    page.getByText("(11) 99999-9999", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".member-facts dd").nth(2)).toHaveText("Sim");
  await expect(page.locator(".member-profile")).not.toContainText("#21");
  await expect(page.locator(".member-avatar")).toHaveCount(0);
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
      await page.getByRole("tab", { name: "Extrato", exact: true }).click();
      await expect(
        page.getByText("Pagamento com descrição", { exact: false }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      const amount = page.locator(".member-balance strong");
      expect(
        await amount.evaluate(
          (el) =>
            el.getBoundingClientRect().height <
            parseFloat(getComputedStyle(el).fontSize) * 2,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `test-results/member-detail-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Filtrar extrato" }).click();
      const dialog = page.getByRole("dialog");
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(12);
      expect(Math.abs(box.x - (width - box.x - box.width))).toBeLessThan(2);
      const input = (await page.getByLabel("Data inicial").boundingBox())!;
      expect(input.width).toBeGreaterThan(box.width - 60);
      await page.getByLabel("Data inicial").fill("2026-01-01");
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
      await page.getByRole("button", { name: "Filtrar extrato" }).click();
      await page.getByRole("button", { name: "Limpar filtros" }).click();
      await page.screenshot({
        path: `test-results/member-filters-${theme}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Filtrar extrato" }),
      ).toBeFocused();
      await page.getByRole("button", { name: "Filtrar extrato" }).click();
      await expect(page.getByLabel("Data inicial")).toHaveValue("2026-01-01");
      await page.keyboard.press("Escape");
      await page.getByRole("tab", { name: "Períodos" }).click();
      await expect(
        page.getByRole("link", { name: /Período 10/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Dados do membro" }),
      ).toBeVisible();
      await expect(
        page.getByText("Saldo atual", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("Ações do membro").click();
      await expect(
        page.getByRole("button", { name: "Editar", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/member-menu-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await expect(page.getByLabel("Ações do membro")).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Excluir", exact: true }),
      ).not.toBeVisible();
      await expect(page.getByRole("link", { name: /Período 9/ })).toContainText(
        "Fechado",
      );
      await page.screenshot({
        path: `test-results/member-profile-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      theme,
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      if (await page.locator(".sidebar.opened").count())
        await page
          .getByRole("button", { name: "Fechar menu", exact: true })
          .click();
      await page.getByRole("tab", { name: "Extrato", exact: true }).click();
      await page.getByRole("heading", { name: /José Antônio/ }).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/member-final-${theme}-${width}.png`,
        animations: "disabled",
        fullPage: true,
      });
    }
  }
  await page.getByLabel("Ações do membro").click();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Arquivar membro?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("tab", { name: "Extrato", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Períodos" })).toBeFocused();
  balance = 150;
  await page.reload();
  await expect(page.locator(".member-balance strong")).toHaveClass(
    "amount-credit",
  );
  await expect(page.locator(".member-payable strong")).toHaveText(/0,00/);
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".member-payable strong")).toHaveClass(
    "amount-credit",
  );
  balance = 0;
  await page.reload();
  await expect(page.locator(".member-balance strong")).toHaveText(/0,00/);
  await expect(page.locator(".member-balance strong")).toHaveClass(
    "amount-credit",
  );
  await expect(page.locator(".member-payable strong")).toHaveClass(
    "amount-credit",
  );
  for (const [slug, label, tone] of [
    ["ativo", "Ativo", "active"],
    ["afastado", "Afastado", "away"],
    ["placet", "Placet", "placet"],
    ["inativo", "Inativo", "inactive"],
  ]) {
    memberStatus = { id: "1", slug, label };
    await page.reload();
    await expect(page.locator(".member-facts .member-status")).toHaveText(
      label,
    );
    await expect(page.locator(".member-facts .member-status")).toHaveClass(
      new RegExp(`status-${tone}`),
    );
    await expect(page.locator(".member-name .member-status")).toHaveCount(0);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await page.screenshot({
        path: `test-results/member-status-${slug}-${theme}.png`,
      });
    }
  }
  fail = true;
  await page.reload();
  await expect(page.getByRole("alert")).toHaveCount(2);
  await expect(
    page.locator(".member-balance strong, .member-payable strong"),
  ).toHaveCount(0);
});
