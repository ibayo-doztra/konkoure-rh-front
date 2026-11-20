import { expect, test } from "@playwright/test";
import { APP_URL, createOwner, invite, open, signIn } from "./support/app";
import { PASSWORD } from "./support/settings";

test("la déconnexion avec un jeton expiré ferme vraiment la session", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);

  // The first logout attempt behaves as if the 15-minute access token had expired.
  let expired = false;
  await page.route("**/api/v1/auth/logout", async (route) => {
    if (expired) return route.continue();
    expired = true;
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": new URL(page.url()).origin,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: { code: "E_TOKEN_EXPIRED", message: "expired" } }),
    });
  });

  const closed = page.waitForResponse(
    (response) => response.url().endsWith("/auth/logout") && response.status() === 204,
  );
  await page.evaluate(async () => {
    const authModule = "/src/lib/api/auth.ts";
    const { logout } = (await import(/* @vite-ignore */ authModule)) as {
      logout: () => Promise<void>;
    };
    await logout();
  });
  await closed;

  await open(page, "/app");
  await expect(page).toHaveURL(/\/login/);
});

test("deux onglets rechargés ensemble gardent la session", async ({ context, page, request }) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);

  const second = await context.newPage();
  await second.goto("/app");
  await expect(second).toHaveURL(APP_URL);

  for (let round = 0; round < 3; round += 1) {
    await Promise.all([page.reload(), second.reload()]);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(second.locator("#main-content")).toBeVisible();
  }

  const third = await context.newPage();
  await third.goto("/app");
  await expect(third).toHaveURL(APP_URL);
  await expect(third.locator("#main-content")).toBeVisible();
});

test("un refresh limité par l'API (429) ne ferme pas la session", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);

  // The API throttles before rotating: the refresh cookie stays valid.
  let throttled = 0;
  await page.route("**/api/v1/auth/refresh", async (route) => {
    if (throttled >= 2) return route.continue();
    throttled += 1;
    return route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": new URL(page.url()).origin,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ error: { code: "E_TOO_MANY_REQUESTS", message: "throttled" } }),
    });
  });

  await page.reload();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page).toHaveURL(APP_URL);
  expect(throttled).toBe(2);
});

test("un membre de deux organisations passe de l'une à l'autre", async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(isMobile, "La barre latérale est repliée sur mobile.");
  const member = await createOwner(request);
  const other = await createOwner(request);
  const link = await invite(request, other, member.email);

  await open(page, link);
  await page.locator("#pwd").fill(PASSWORD);
  await page.getByRole("button", { name: "Rejoindre l'organisation" }).click();
  await expect(page).toHaveURL(APP_URL);

  const switcher = page.getByRole("combobox", { name: "Changer d'organisation" });
  await expect(switcher).toBeVisible();
  const before = (await switcher.textContent())?.trim();
  const target = before === member.organizationName ? other : member;

  const reloaded = page.waitForRequest(
    (req) =>
      req.url().endsWith("/api/v1/me") &&
      req.headers()["x-organization-id"] === target.organizationId,
  );
  await switcher.click();
  await page.getByRole("option", { name: target.organizationName }).click();
  await reloaded;
  await expect(switcher).toHaveText(target.organizationName);

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Changer d'organisation" })).toHaveText(
    target.organizationName,
  );
});
