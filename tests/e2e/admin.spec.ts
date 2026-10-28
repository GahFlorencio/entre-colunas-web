import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page, admin = true) {
  const authorities: Record<string, unknown>[] = [];
  const lodges: Record<string, unknown>[] = [];
  const users: Record<string, unknown>[] = [];
  const links: Record<string, unknown>[] = [];
  const bodies: { path: string; body: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, "");
    if (path === "/login")
      return route.fulfill({
        json: { token: "admin-token", type: "Bearer", ttl: 3600 },
      });
    if (path === "/me")
      return route.fulfill({
        json: {
          user: {
            id: "5",
            name: "Admin",
            email: "admin@example.com",
            is_admin: admin,
            lodges: [],
          },
        },
      });
    if (path.startsWith("/admin/")) {
      expect(req.headers().authorization).toBe("Bearer admin-token");
      const resource = path.split("/").at(-1)!;
      const rows = (
        { authorities, lodges, users, "user-lodges": links } as Record<
          string,
          Record<string, unknown>[]
        >
      )[resource];
      if (req.method() === "POST") {
        const body = req.postDataJSON();
        bodies.push({ path, body });
        if (body.label === "DUP")
          return route.fulfill({
            status: 409,
            json: { message: "Este cadastro ou vínculo já existe." },
          });
        const row =
          resource === "lodges"
            ? { ...body, id: "2", masonic_authority: authorities[0] }
            : resource === "users"
              ? {
                  id: "9",
                  name: body.name,
                  email: body.email,
                  active: true,
                  is_admin: false,
                }
              : resource === "user-lodges"
                ? { id: "8", user: users[0], lodge: lodges[0] }
                : { ...body, id: "1" };
        rows.unshift(row);
        return route.fulfill({ status: 201, json: row });
      }
      return route.fulfill({
        json: {
          results: rows,
          total: rows.length,
          page: 1,
          per_page: Number(url.searchParams.get("per_page") || 20),
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/login");
  await page.getByLabel(/E-mail|Email/i).fill("admin@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("password123");
  await page
    .getByRole("button", { name: "Entrar na minha conta", exact: true })
    .click();
  return bodies;
}
test("admin without a lodge creates authorities, lodges, users and associations", async ({
  page,
}, testInfo) => {
  const bodies = await setup(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Cadastros do sistema" }),
  ).toBeVisible();
  await page.getByLabel("Sigla", { exact: true }).fill("GLE");
  await page.getByLabel("Nome da potência").fill("Grande Loja");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.locator(".success-message")).toContainText(
    "Cadastro criado com sucesso.",
  );
  await page.getByRole("button", { name: "Lojas", exact: true }).click();
  await page.getByLabel("Nome da loja").fill("União Fraterna");
  await page.getByLabel("Número", { exact: true }).fill("9007199254740993");
  await page
    .getByRole("combobox", { name: "Potência", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.locator(".success-message")).toContainText(
    "Cadastro criado com sucesso.",
  );
  await page.getByRole("button", { name: "Usuários", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Ana Silva");
  await page.getByLabel("E-mail", { exact: true }).fill("ana@example.com");
  await page.getByLabel("Senha inicial").fill("new-password123");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.locator(".success-message")).toContainText(
    "Cadastro criado com sucesso.",
  );
  await expect(page.getByLabel("Senha inicial")).toHaveValue("");
  await page.getByRole("button", { name: "Vínculos", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Usuário", exact: true })
    .selectOption("9");
  await page
    .getByRole("combobox", { name: "Loja", exact: true })
    .selectOption("2");
  await page.getByRole("button", { name: "Criar vínculo" }).click();
  await expect(page.locator(".success-message")).toContainText(
    "Vínculo criado com sucesso.",
  );
  await expect(page.locator(".row")).toContainText("Ana Silva");
  expect(bodies.map((b) => b.path)).toEqual([
    "/admin/authorities",
    "/admin/lodges",
    "/admin/users",
    "/admin/user-lodges",
  ]);
  expect(bodies[1].body.number).toBe("9007199254740993");
  expect(bodies[3].body).toEqual({ user_id: "9", masonic_lodge_id: "2" });
  await page.screenshot({
    path: `/tmp/entre-colunas-admin-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("reports conflicts and retains the form for correction", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Sigla", { exact: true }).fill("DUP");
  await page.getByLabel("Nome da potência").fill("Grande Loja");
  await page.getByRole("button", { name: "Cadastrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Este cadastro ou vínculo já existe.",
  );
  await expect(page.getByLabel("Sigla", { exact: true })).toHaveValue("DUP");
});
test("hides administration and refuses direct navigation for common accounts", async ({
  page,
}) => {
  await setup(page, false);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(
    0,
  );
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Cadastros do sistema" }),
  ).toHaveCount(0);
});
