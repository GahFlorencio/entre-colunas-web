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
  await expect(page.getByRole("heading", { name: "Olá, Ana." })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Olá, Ana." })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: member.name, exact: true }),
  ).toHaveCount(0);
});
