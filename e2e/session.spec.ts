import { expect, test } from "@playwright/test";
import { APP_URL, createOwner, open, signIn } from "./support/app";

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
