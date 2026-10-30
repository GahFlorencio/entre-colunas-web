import { test, expect } from "@playwright/test";

test("payment recency is shared by list and member detail with exact ranges and recoverable errors", async ({
  page,
}, info) => {
  const days = [0, 1, 30, 31, 60, 61, 80, 81, null];
  const members = days.map((_, i) => ({
    id: String(21 + i),
    name: `José Antônio de Albuquerque ${i + 1}`,
    phone: i === 0 ? "11999999999" : null,
    agape_participant: true,
    lodge_beggin: "2020-01-01T12:00:00Z",
    status: { id: "1", slug: "ativo", label: "Ativo" },
  }));
  let fail = false;
  let balancesFail = false;
  const requests: string[][] = [];
  const accountRequests: string[][] = [];
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
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const send = (json: unknown) => route.fulfill({ json });
    if (path.endsWith("/me"))
      return send({
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
      });
    if (path.endsWith("/members/payment-recency")) {
      if (fail)
        return route.fulfill({
          status: 500,
          json: { message: "Consulta indisponível" },
        });
      const ids = url.searchParams.get("member_ids")!.split(",");
      requests.push(ids);
      return send({
        masonic_lodge_id: "12",
        calculated_at: "2026-10-29T12:00:00Z",
        results: ids.map((member_id) => ({
          member_id,
          last_payment_at:
            days[Number(member_id) - 21] === null || member_id === "25"
              ? null
              : "2026-10-01T12:00:00Z",
          reference_at:
            days[Number(member_id) - 21] === null
              ? null
              : "2026-10-01T12:00:00Z",
          reference_source:
            days[Number(member_id) - 21] === null
              ? null
              : member_id === "25"
                ? "first_period"
                : "member_payment",
          days_since_last_payment: days[Number(member_id) - 21],
        })),
      });
    }
    if (path.endsWith("/members/financial/accounts")) {
      accountRequests.push(url.searchParams.get("member_ids")!.split(","));
      if (balancesFail)
        return route.fulfill({
          status: 503,
          json: { error: "Valores financeiros indisponíveis" },
        });
      const ids = url.searchParams.get("member_ids")!.split(",");
      return send({
        masonic_lodge_id: "12",
        results: ids.map((member_id) => ({
          member_id,
          balance: member_id === "21" ? -1234567.89 : 500,
          payable: member_id === "21" ? 1234567.89 : 0,
        })),
      });
    }
    if (path.endsWith("/members"))
      return send({
        results: members,
        total: members.length,
        page: 1,
        per_page: 20,
      });
    if (path.endsWith("/member/21")) return send(members[0]);
    if (path.endsWith("/member-statuses"))
      return send([{ ...members[0]!.status, active: true }]);
    if (path.endsWith("/financial/account"))
      return send({ id: "1", type: "member", member_id: "21", balance: -300 });
    return send({
      results: [],
      total: 0,
      page: 1,
      per_page: 20,
      balance: -300,
      account_type: "member",
      member_id: "21",
      totals: { total_credits: 0, total_debits: 300, operations: [] },
    });
  });
  await page.goto("/membros");
  await expect(page.locator(".member-row .payment-recency")).toHaveCount(9);
  const expected = days.map(() => "neutral");
  for (const [index, tone] of expected.entries()) {
    const badge = page.locator(".member-row .payment-recency").nth(index);
    await expect(badge).toHaveClass(new RegExp(tone));
    await expect(badge).toContainText(
      days[index] === null
        ? "Sem período ou pagamento registrado"
        : `Sem pagamento há ${days[index]} ${days[index] === 1 ? "dia" : "dias"}`,
    );
  }
  expect(requests).toEqual([members.map((m) => m.id)]);
  expect(accountRequests).toEqual([members.map((m) => m.id)]);
  await expect(page.locator(".member-row .avatar")).toHaveCount(0);
  await expect(
    page.locator(".member-row").first().locator(".member-phone"),
  ).toHaveText("(11) 99999-9999");
  await expect(
    page.locator(".member-row").first().locator(".member-current strong"),
  ).toHaveText(/R\$.*1\.234\.567,89/);
  await expect(
    page.locator(".member-row").nth(1).locator(".member-current strong"),
  ).toHaveText(/R\$.*500,00/);

  for (const path of ["/membros", "/membros/21"]) {
    await page.goto(path);
    await expect(
      page.locator(".payment-recency.neutral").first(),
    ).toContainText("Sem pagamento há 0 dias");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        if (await page.locator(".sidebar.opened").count())
          await page
            .getByRole("button", { name: "Fechar menu", exact: true })
            .click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(page.locator(".payment-recency").first()).toBeVisible();
        if (path === "/membros") {
          const amounts = page
            .locator(".member-row")
            .first()
            .locator(".member-amount strong");
          for (const amount of await amounts.all()) {
            expect(
              await amount.evaluate(
                (el) =>
                  el.getBoundingClientRect().height <=
                  parseFloat(getComputedStyle(el).fontSize) * 2,
              ),
            ).toBe(true);
          }
          if (width >= 1280) {
            const edges = await page
              .locator(".member-current strong")
              .evaluateAll((nodes) =>
                nodes.map((node) => node.getBoundingClientRect().right),
              );
            expect(Math.max(...edges) - Math.min(...edges)).toBeLessThan(1);
          }
        }

        if (width < 760) {
          await expect
            .poll(() =>
              page
                .locator(".sidebar")
                .evaluate((el) => el.getBoundingClientRect().right),
            )
            .toBeLessThanOrEqual(1);
        }
        await page.screenshot({
          animations: "disabled",
          path: `test-results/payment-${path === "/membros" ? "list" : "detail"}-${info.project.name}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  balancesFail = true;
  await page.goto("/membros");
  await expect(
    page.getByText("Saldos indisponíveis.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".member-row").first().locator(".member-current"),
  ).toContainText("Indisponível");
  await expect(
    page.locator(".member-row").first().locator(".member-current strong"),
  ).toHaveCount(0);
  balancesFail = false;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.locator(".member-row").first().locator(".member-current strong"),
  ).toHaveText(/1\.234\.567,89/);
  fail = true;
  await page.goto("/membros/21");
  await expect(
    page.getByText("Pagamentos indisponíveis", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sem pagamento há 0 dias", { exact: true }),
  ).toHaveCount(0);
  fail = false;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByText("Sem pagamento há 0 dias", { exact: true }),
  ).toBeVisible();
});
