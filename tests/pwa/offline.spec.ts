import { test, expect } from "@playwright/test";
test("production manifest and service worker support offline launch without API caching", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Bom ter você aqui." }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(
    manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable"),
  ).toBe(true);
  for (const icon of manifest.icons)
    expect((await page.request.get(icon.src)).ok()).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.route("**/api/cache-probe", (route) =>
    route.fulfill({ json: { private: "do-not-cache" } }),
  );
  await page.evaluate(() =>
    fetch("/api/cache-probe", { cache: "no-store" }).then((r) => r.json()),
  );
  const cachedUrls = await page.evaluate(async () => {
    const all = await Promise.all(
      (await caches.keys()).map(async (key) =>
        (await (await caches.open(key)).keys()).map((request) => request.url),
      ),
    );
    return all.flat();
  });
  expect(cachedUrls.some((url) => url.includes("/api/"))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bom ter você aqui." }),
  ).toBeVisible();
  await expect(
    page.getByText("Você está offline.", { exact: false }),
  ).toBeVisible();
});
