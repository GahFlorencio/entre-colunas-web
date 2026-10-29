import { test, expect, type Page } from "@playwright/test";
const member = {
  id: "9007199254740993",
  name: "Carlos Almeida",
  phone: "11999999999",
  agape_participant: true,
  lodge_beggin: "2026-01-01T00:00:00.000Z",
  status: { id: "1", slug: "ativo", label: "Ativo" },
};
const period = {
  id: "81",
  masonic_lodge_id: "12",
  sequence: 3,
  status: "open",
  opened_at: "2026-10-01T00:00:00.000Z",
  closed_at: null,
  captured_members: 1,
  members: [
    {
      member_id: member.id,
      member_name: member.name,
      member_status_slug: "ativo",
      agape_participant: true,
      captured_at: "2026-10-01T00:00:00.000Z",
    },
  ],
  statements_count: 0,
  acrescimo: 0,
  closing_agape_value: null,
  closing_contribution_value: null,
  closing_differences: null,
};
const expense = {
  id: "501",
  label: "Manutenção do templo",
  masonic_lodge_id: "12",
  financial_period_id: "81",
  total_value: 300,
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
  installments: [
    {
      id: "1",
      number: 1,
      target_period_sequence: 3,
      financial_period_id: "81",
      value: 150,
      status: "scheduled",
    },
  ],
};
const movement = {
  id: "601",
  financial_operation_id: "701",
  financial_period_id: "81",
  direction: "credit",
  value: 150,
  description: "Pagamento recebido",
  category_label: "Contribuição",
  operation_type: "member_payment",
  created_at: "2026-10-20T10:00:00.000Z",
};
const operation = {
  id: "701",
  type: "member_payment",
  financial_period_id: "81",
  member_id: member.id,
  description: "Pagamento recebido",
  created_user_id: "5",
  created_at: "2026-10-20T10:00:00.000Z",
  entry_ids: ["601"],
  entries: [
    {
      id: "601",
      financial_account_id: "51",
      financial_period_id: "81",
      direction: "credit",
      value: 150,
      description: "Pagamento recebido",
      category_label: "Contribuição",
      source_entry_id: null,
    },
  ],
};
function pageOf(results: unknown[], page = 1, per_page = 20) {
  return { results, total: results.length, page, per_page };
}
async function mock(
  page: Page,
  options: { ttl?: number; summaryFailure?: boolean } = {},
) {
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, "");
    const send = (value: unknown, status = 200) =>
      route.fulfill({ status, json: value });
    if (path === "/login")
      return send({
        token: "test-session",
        type: "Bearer",
        ttl: options.ttl || 3600,
      });
    if (path === "/me")
      return send({
        user: {
          id: "5",
          name: "Ana Silva",
          email: "ana@example.com",
          lodges: [
            {
              id: "12",
              label: "Guardiões da Luz",
              number: "998",
              juridical_document: null,
              masonic_authority: { id: "1", label: "GLE", name: "Grande Loja" },
            },
            {
              id: "13",
              label: "União Fraterna",
              number: "999",
              juridical_document: null,
              masonic_authority: { id: "1", label: "GLE", name: "Grande Loja" },
            },
          ],
        },
      });
    if (path === "/member-statuses")
      return send([
        { id: "1", slug: "ativo", label: "Ativo", active: true },
        { id: "2", slug: "afastado", label: "Afastado", active: true },
      ]);
    if (path.endsWith("/financial/summary"))
      return options.summaryFailure
        ? send({ error: "Valores indisponíveis" }, 503)
        : send({
            masonic_lodge_id: path.includes("/13/") ? "13" : "12",
            cash_balance: 900,
            unpaid_expenses_total: 300,
            accounts_receivable_total: 150,
            calculated_at: "2026-10-26T12:00:00.000Z",
          });
    if (path.endsWith("/financial/account/movements"))
      return send({
        ...pageOf([movement]),
        balance: 150,
        account_type: path.includes("/member/") ? "member" : "lodge",
        member_id: path.includes("/member/") ? member.id : null,
        totals: { total_credits: 150, total_debits: 0, operations: [] },
      });
    if (path.endsWith("/financial/account"))
      return send({
        id: "51",
        type: "member",
        member_id: member.id,
        balance: 150,
      });
    if (path.endsWith("/financial/periods/preview"))
      return send({
        financial_period_id: "81",
        sequence: 3,
        acrescimo: 0,
        results: [
          {
            member_id: member.id,
            member_name: member.name,
            member_status_slug: "ativo",
            current_balance: 150,
            projected_balance: 20,
            new_charges: 130,
            rounding_base_value: 130,
            divisors: 1,
            items: [
              {
                type: "contribution",
                description: "Contribuição mensal",
                value: 100,
                direction: "debit",
                divisor: null,
              },
            ],
          },
        ],
        differences: [],
        impediments: [],
      });
    if (path.endsWith("/financial/periods/81/close"))
      return send({
        closed_period_id: "81",
        next_period: { ...period, id: "82" },
        statements_created: 1,
      });
    if (path.endsWith("/financial/periods/81")) return send(period);
    if (path.endsWith("/financial/periods"))
      return send(
        pageOf(
          [period],
          Number(url.searchParams.get("page") || 1),
          Number(url.searchParams.get("per_page") || 20),
        ),
      );
    if (path.endsWith("/members"))
      return send(
        pageOf([member], 1, Number(url.searchParams.get("per_page") || 20)),
      );
    if (path.includes("/member/")) return send(member);
    if (path.endsWith("/expense/type"))
      return send([
        { id: "1", slug: "rateio", label: "Rateio" },
        { id: "2", slug: "individual", label: "Individual" },
        { id: "3", slug: "geral", label: "Geral" },
      ]);
    if (path.endsWith("/expense/category"))
      return send(
        pageOf(
          [
            {
              id: "2",
              slug: "manutencao",
              label: "Manutenção",
              active: true,
              scope: "lodge",
            },
          ],
          1,
          Number(url.searchParams.get("per_page") || 20),
        ),
      );
    if (path.endsWith("/expense/501")) return send(expense);
    if (path.endsWith("/expense"))
      return send(req.method() === "GET" ? pageOf([expense]) : expense);
    if (path.endsWith("/financial/operations/701")) return send(operation);
    if (path.endsWith("/financial/operations"))
      return send(pageOf([operation]));
    if (path.endsWith("/financial/settings"))
      return send({
        masonic_lodge_id: "12",
        monthly_contribution_value: 100,
        monthly_agape_value: 30,
        updated_user_id: null,
        updated_at: null,
      });
    return send({ message: "Rota de teste não mapeada: " + path }, 404);
  });
}
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("ana@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-teste");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
}
async function navigate(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("login, dashboard and routes render without overflow or runtime errors", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mock(page);
  await login(page);
  await expect(page.getByText("R$ 900,00", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  for (const path of [
    "/membros",
    "/membros/" + member.id,
    "/despesas",
    "/despesas/501",
    "/periodos",
    "/periodos/81",
    "/operacoes",
    "/operacoes/701",
    "/extrato",
    "/configuracoes",
  ]) {
    await navigate(page, path);
    await expect(page.locator(".spinner")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: `test-results/settings-dark-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("member registration sends a textual ID and API field names", async ({
  page,
}) => {
  await mock(page);
  await login(page);
  await navigate(page, "/membros?novo=1");
  await page.getByLabel("Nome completo").fill("João Pereira");
  await page.getByLabel("Telefone", { exact: true }).fill("11988888888");
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/lodge/12/member") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Salvar membro" }).click();
  const body = (await request).postDataJSON();
  expect(body.name).toBe("João Pereira");
  expect(body.member_status_slug).toBe("ativo");
  expect(body.agape_participant).toBe(true);
});

test("expense rateio preserves the include-away-members rule", async ({
  page,
}) => {
  await mock(page);
  await login(page);
  await navigate(page, "/despesas?novo=1");
  await page.getByLabel("Descrição", { exact: true }).fill("Conta de energia");
  await page.getByLabel("Valor total (R$)").fill("120.50");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Tipo", exact: true })
    .selectOption("1");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption("2");
  await page.getByLabel("Distribuição").selectOption("false");
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/api/lodge/12/expense") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Salvar despesa" }).click();
  const sent = await request;
  expect(sent.postDataJSON()).toMatchObject({
    ratio_to_all: false,
    total_value: 120.5,
    expense_type_id: "1",
  });
  expect(sent.headers()["idempotency-key"]).toBeTruthy();
});

test("uncertain financial write replays identical body and idempotency key", async ({
  page,
}) => {
  await mock(page);
  const sent: { body: string | null; key: string }[] = [];
  await page.route("**/api/lodge/12/financial/incomes", async (route) => {
    sent.push({
      body: route.request().postData(),
      key: route.request().headers()["idempotency-key"],
    });
    if (sent.length === 1) await route.abort("failed");
    else
      await route.fulfill({
        json: {
          id: "702",
          type: "lodge_income",
          financial_period_id: "81",
          member_id: null,
          entry_ids: ["602"],
          value: 50,
        },
      });
  });
  await login(page);
  await navigate(page, "/operacoes?novo=1");
  await page.getByLabel("Descrição", { exact: true }).fill("Doação");
  await page.getByLabel("Valor (R$)").fill("50");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption("2");
  await page
    .getByRole("button", { name: "Registrar operação", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("O resultado do lançamento não pôde ser confirmado.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page).toHaveURL(/\/operacoes$/);
  await page.route("**/api/me", (route) => route.abort("failed"));
  await page.reload();
  await expect(
    page.getByText("Não foi possível verificar sua sessão.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((key) =>
        key.startsWith("entre-colunas.pending."),
      ),
    ),
  ).toBe(true);
  await page.unroute("**/api/me");
  await page.reload();
  await page
    .getByRole("button", { name: "Verificar lançamento pendente" })
    .click();
  await expect(
    page.getByText("Lançamento confirmado. Os dados foram atualizados."),
  ).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
});

test("closing a period requires preview and explicit review", async ({
  page,
}) => {
  await mock(page);
  await login(page);
  await navigate(page, "/periodos/81");
  await page.getByRole("button", { name: "Revisar fechamento" }).click();
  await expect(
    page.getByRole("button", { name: "Fechar período", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Calcular prévia" }).click();
  await expect(
    page.getByText("Saldo projetado:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fechar período", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Revisei os valores e confirmo o fechamento.").check();
  const request = page.waitForRequest((r) =>
    r.url().endsWith("/financial/periods/81/close"),
  );
  await page
    .getByRole("button", { name: "Fechar período", exact: true })
    .click();
  expect((await request).postDataJSON()).toEqual({ acrescimo: 0 });
});

test("session expiry clears private UI and returns to login", async ({
  page,
}) => {
  await mock(page, { ttl: 2 });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bom ter você aqui." }),
  ).toBeVisible({ timeout: 7000 });
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("entre-colunas.web.session"),
    ),
  ).toBeNull();
  await expect(
    page.getByText("Sua sessão expirou. Entre novamente."),
  ).toBeVisible();
});

test("failed financial summary never fabricates zero balances", async ({
  page,
}) => {
  await mock(page, { summaryFailure: true });
  await login(page);
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect(page.locator(".stat-grid")).toHaveCount(0);
});

test("switching lodge discards previous member page", async ({ page }) => {
  await mock(page);
  await login(page);
  await navigate(page, "/membros/" + member.id);
  await page.getByLabel("Loja ativa").selectOption("13");
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: member.name, exact: true }),
  ).toHaveCount(0);
});

test("Caixa keeps global cards compact and filters collapsed on mobile", async ({
  page,
}, info) => {
  await mock(page);
  await login(page);
  await navigate(page, "/operacoes");
  await expect(
    page.getByRole("heading", { name: "Caixa", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Caixa da Loja", exact: true }),
  ).toContainText("900,00");
  await expect(
    page.getByRole("article", { name: "Despesas a pagar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Valores a Receber", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Membro: Todos os membros", exact: true }),
  ).not.toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/cash-${info.project.name}-${width}-${theme}.png`,
        animations: "disabled",
      });
    }
  }
  await page
    .getByRole("button", { name: "Filtrar caixa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Membro: Todos os membros", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/cash-filter-modal-${info.project.name}.png`,
    animations: "disabled",
  });
  await page.getByLabel("Tipo", { exact: true }).selectOption("member_payment");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Filtrar caixa", exact: true })
    .click();
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveValue("");
  await page.getByLabel("Tipo", { exact: true }).selectOption("member_payment");
  await expect(
    page.getByRole("button", { name: "Limpar filtros" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Filtrar caixa", exact: true })
    .click();
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveValue(
    "member_payment",
  );
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByLabel("Tipo", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await page.getByRole("button", { name: "Registrar operação" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Caixa does not replace unavailable totals with zero", async ({
  page,
}) => {
  await mock(page, { summaryFailure: true });
  await login(page);
  await navigate(page, "/operacoes");
  await expect(
    page.getByRole("heading", { name: "Caixa", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cash-cards")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Histórico do caixa" }),
  ).toBeVisible();
});

test("Caixa selects members and periods by searchable data across pages", async ({
  page,
}, info) => {
  await mock(page);
  const memberPages: number[] = [];
  await page.route("**/api/**/members?**", (route) => {
    const url = new URL(route.request().url()),
      p = Number(url.searchParams.get("page")),
      size = Number(url.searchParams.get("per_page"));
    memberPages.push(p);
    const rows = Array.from({ length: 101 }, (_, i) => ({
      ...member,
      id: i === 100 ? member.id : String(i + 1),
      name: i === 100 ? "João Carlos Almeida" : `Membro ${i + 1}`,
    }));
    return route.fulfill({
      json: {
        ...pageOf(rows.slice((p - 1) * size, p * size), p, size),
        total: rows.length,
      },
    });
  });
  await login(page);
  await navigate(page, "/operacoes");
  await page.setViewportSize({ width: 320, height: 800 });
  await page
    .getByRole("button", { name: "Filtrar caixa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Membro: Todos os membros", exact: true })
    .click();
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const dialog = page.getByRole("dialog");
    const search = page.getByRole("searchbox", {
      name: "Buscar membro",
      exact: true,
    });
    await expect
      .poll(async () => Math.round((await search.boundingBox())!.width))
      .toBeGreaterThan(width < 400 ? 250 : 400);
    const box = (await dialog.boundingBox())!,
      inputBox = (await search.boundingBox())!;
    expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThan(2);
    expect(box.width).toBeLessThanOrEqual(480);
    expect(Math.abs(inputBox.x - box.x - (width < 768 ? 17 : 21))).toBeLessThan(
      2,
    );
    const list = page.locator(".selector-options:visible");
    expect(
      Math.abs((await list.boundingBox())!.width - inputBox.width),
    ).toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      await page.screenshot({
        path: `/tmp/cash-responsive-${info.project.name}-${width}-${theme}.png`,
        animations: "disabled",
      });
    }
  }
  await page.setViewportSize({ width: 320, height: 420 });
  const searchField = page.getByRole("searchbox", {
    name: "Buscar membro",
    exact: true,
  });
  await expect(
    page.getByRole("heading", { name: "Selecionar membro", exact: true }),
  ).toBeVisible();
  expect((await searchField.boundingBox())!.height).toBeLessThanOrEqual(48);
  const optionList = page.locator(".selector-options:visible");
  await expect
    .poll(async () => optionList.evaluate((el) => el.clientHeight))
    .toBeGreaterThan(100);
  expect(
    await optionList.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await optionList.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    page.getByRole("button", {
      name: "João Carlos Almeida Ativo",
      exact: true,
    }),
  ).toBeInViewport();
  await optionList.evaluate((el) => (el.scrollTop = 0));
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  await page.screenshot({
    path: `/tmp/cash-search-short-${info.project.name}.png`,
    animations: "disabled",
  });
  await searchField.fill("joao");
  await searchField.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "João Carlos Almeida Ativo",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/cash-search-${info.project.name}.png`,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "João Carlos Almeida Ativo", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Membro: João Carlos Almeida",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Período: Todos os períodos", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Buscar período", exact: true })
    .fill("inexistente");
  await expect(
    page.getByText("Nenhum resultado.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Buscar período", exact: true })
    .fill("3");
  await page.getByRole("button", { name: /Período 3 Aberto/ }).click();
  const request = page.waitForRequest(
    (req) =>
      req.url().includes("/financial/operations?") &&
      new URL(req.url()).searchParams.get("member_id") === member.id,
  );
  await page
    .getByRole("button", { name: "Aplicar filtros", exact: true })
    .click();
  const url = new URL((await request).url());
  expect(url.searchParams.get("financial_period_id")).toBe(period.id);
  expect(memberPages).toEqual([1, 2]);
  await page
    .getByRole("button", { name: "Filtrar caixa", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Membro: João Carlos Almeida",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Período: Período 3", exact: true }),
  ).toBeVisible();
});

test("overview uses compact cards and readable ledger in both themes", async ({
  page,
}, info) => {
  await mock(page);
  await page.route("**/financial/account/movements?*", (route) =>
    route.fulfill({
      json: {
        ...pageOf([
          {
            ...movement,
            description:
              "Pagamento com descrição extensa do membro José Antônio de Albuquerque para contribuição da loja",
            value: 1234567.89,
          },
          {
            ...movement,
            id: "602",
            direction: "debit",
            description: "Pagamento de manutenção e conservação do templo",
            value: 987654.32,
            operation_type: "expense_registration",
            created_at: "2026-10-19T10:00:00Z",
          },
        ]),
        balance: 150,
        account_type: "lodge",
        member_id: null,
        totals: {
          total_credits: 1234567.89,
          total_debits: 987654.32,
          operations: [],
        },
      },
    }),
  );
  await login(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const overview = page.locator(".overview");
      await expect(overview.locator(".ledger-entry")).toHaveCount(2);
      await expect(overview.locator(".ledger-day h3")).toHaveCount(0);
      await expect(overview).not.toContainText("Até 5 movimentos recentes");
      await expect(overview).not.toContainText("expense_registration");
      await expect(overview.locator(".ledger-entry").first()).toContainText(
        "20/10/2026 - Contribuição",
      );
      await expect(overview.locator(".ledger-entry").nth(1)).toContainText(
        "19/10/2026 - Contribuição",
      );
      await expect(overview.getByText("Débito", { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const cards = await overview.locator(".stat").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width };
        }),
      );
      if (width < 768) {
        expect(cards[0]!.y).toBeLessThan(cards[1]!.y);
        expect(cards[1]!.y).toBe(cards[2]!.y);
      } else expect(cards[0]!.y).toBe(cards[2]!.y);
      const entry = overview.locator(".ledger-entry").first();
      const title = await entry.locator(".ledger-title").boundingBox();
      const value = await entry.locator(".ledger-value").boundingBox();
      if (width < 600) {
        expect(value!.y).toBeGreaterThan(title!.y + title!.height);
        expect(value!.x).toBe(title!.x);
      }
      await page.screenshot({
        path: `test-results/overview-${info.project.name}-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
});

test("Caixa ledger preserves entry values, directions and operation ordering", async ({
  page,
}, info) => {
  await mock(page);
  const entry = operation.entries[0]!;
  const longDescription =
    "Pagamento e ajuste de despesas com descrição extensa para conferir quebra de linhas e leitura completa";
  await page.route("**/financial/operations?*", (route) =>
    route.fulfill({
      json: pageOf([
        {
          ...operation,
          description: longDescription,
          entries: [
            { ...entry, description: longDescription, value: 9876543.25 },
            {
              ...entry,
              id: "602",
              financial_account_id: "52",
              description: "Débito registrado",
              direction: "debit",
              value: 9876543.25,
              category_label: null,
            },
          ],
          entry_ids: ["601", "602"],
        },
        {
          ...operation,
          id: "702",
          created_at: "2026-10-19T10:00:00Z",
          description: "Operação sem lançamentos",
          entries: [],
          entry_ids: [],
        },
        {
          ...operation,
          id: "703",
          description: "Crédito seguinte",
          entries: [{ ...entry, id: "603", description: "Crédito seguinte" }],
          entry_ids: ["603"],
        },
      ]),
    }),
  );
  await login(page);
  await navigate(page, "/operacoes");
  const history = page.getByRole("region", { name: "Histórico do caixa" });
  const rows = history.locator(".ledger-entry");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("+ R$");
  await expect(rows.nth(0)).toContainText("9.876.543,25");
  await expect(rows.nth(0)).toContainText("Crédito");
  await expect(rows.nth(1)).toContainText("− R$");
  await expect(rows.nth(1)).toContainText("Débito");
  await expect(rows.nth(0).locator(".ledger-meta")).toHaveText(
    "20/10/2026 - Contribuição",
  );
  await expect(rows.nth(1).locator(".ledger-meta")).toHaveText("20/10/2026");
  await expect(rows.nth(2)).toContainText("Sem lançamentos");
  await expect(rows.nth(2)).not.toContainText("0,00");
  await expect(history.locator(".ledger-day h3")).toHaveText([
    "20/10/2026",
    "19/10/2026",
    "20/10/2026",
  ]);
  await expect(history.locator(".pagination")).toContainText("3 registro(s)");
  await expect(rows.nth(1)).toHaveAttribute("href", "/operacoes/701");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      const copy = await rows.first().locator(".ledger-copy").boundingBox();
      const amount = await rows.first().locator(".ledger-value").boundingBox();
      if (width < 600) {
        expect(amount!.y).toBeGreaterThan(copy!.y);
        expect(amount!.x).toBeCloseTo(copy!.x, 0);
      }
      expect(
        await history.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect(
        (await history.boundingBox())!.x + (await history.boundingBox())!.width,
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `/tmp/cash-ledger-${width}-${theme}-${info.project.name}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await rows.first().focus();
  await expect(rows.first()).toBeFocused();
  await rows.first().press("Enter");
  await expect(page).toHaveURL(/operacoes\/701$/);
});

test("lodge statement uses date and category ledger subtitles", async ({
  page,
}, info) => {
  await mock(page);
  await page.route("**/financial/account/movements?*", (route) =>
    route.fulfill({
      json: {
        ...pageOf([
          {
            ...movement,
            description:
              "Pagamento com descrição extensa para manter a leitura completa em telas pequenas",
            value: 1234567.89,
          },
          {
            ...movement,
            id: "602",
            direction: "debit",
            value: 900,
            category_label: null,
            created_at: "2026-10-19T10:00:00Z",
          },
        ]),
        balance: 150,
        account_type: "lodge",
        member_id: null,
        totals: {
          total_credits: 1234567.89,
          total_debits: 900,
          operations: [],
        },
      },
    }),
  );
  await login(page);
  await navigate(page, "/extrato");
  const rows = page.locator(".lodge-movements .ledger-entry");
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator(".ledger-meta")).toHaveText(
    "20/10/2026 - Contribuição",
  );
  await expect(rows.nth(1).locator(".ledger-meta")).toHaveText("19/10/2026");
  await expect(rows.first()).toContainText("Crédito");
  await expect(rows.nth(1)).toContainText("Débito");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      expect(
        await page
          .locator(".lodge-movements")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/lodge-ledger-${width}-${theme}-${info.project.name}.png`,
        animations: "disabled",
        fullPage: true,
      });
    }
  }
});

test("lodge PDF exports every filtered page and blocks partial or stale downloads", async ({
  page,
}, info) => {
  await mock(page);
  const requested: number[] = [];
  let fail = false,
    stale = false;
  await page.route("**/financial/account/movements?*", async (route) => {
    const url = new URL(route.request().url());
    const p = Number(url.searchParams.get("page") || 1),
      size = Number(url.searchParams.get("per_page") || 20);
    if (size === 100) {
      requested.push(p);
      expect(url.searchParams.get("from")).toBe("2026-10-01");
      expect(url.searchParams.get("to")).toBe("2026-10-29");
      if (p === 2 && fail)
        return route.fulfill({
          status: 500,
          json: { message: "Falha ao consultar" },
        });
      if (p === 2 && stale) {
        await page
          .getByLabel("Data inicial", { exact: true })
          .fill("2026-10-02");
      }
    }
    const rows = Array.from({ length: 105 }, (_, i) => ({
      ...movement,
      id: String(i + 1),
      description: `Movimento ${i + 1} - Manutenção e conservação das instalações da loja com descrição completa`,
      value: i % 2 ? 1234567.89 : 70.25,
      direction: i % 2 ? "debit" : "credit",
      category_label: i % 3 ? "Contribuição e manutenção" : null,
    }));
    return route.fulfill({
      json: {
        ...pageOf(rows.slice((p - 1) * size, p * size), p, size),
        total: 105,
        balance: 9876.54,
        account_type: "lodge",
        member_id: null,
        totals: { total_credits: 0, total_debits: 0, operations: [] },
      },
    });
  });
  await login(page);
  await navigate(page, "/extrato");
  await page.getByLabel("Data inicial", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Data final", { exact: true }).fill("2026-10-29");
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  const button = page.getByRole("button", { name: "Exportar extrato em PDF" });
  const downloaded = page.waitForEvent("download");
  await button.click();
  await (
    await downloaded
  ).saveAs(`/tmp/lodge-statement-report-${info.project.name}.pdf`);
  expect(requested).toEqual([1, 2]);
  let unexpectedDownload = false;
  page.on("download", () => {
    unexpectedDownload = true;
  });
  fail = true;
  await button.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(button).toBeEnabled();
  expect(unexpectedDownload).toBe(false);
  fail = false;
  stale = true;
  await button.click();
  await expect(page.getByRole("alert")).toContainText("mudaram");
  expect(unexpectedDownload).toBe(false);
});
