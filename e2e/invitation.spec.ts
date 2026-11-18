import { expect, test } from "@playwright/test";
import { APP_URL, createOwner, invite, open, signUp, uniqueEmail } from "./support/app";
import { PASSWORD } from "./support/settings";

test("une personne invitée crée son compte et rejoint l'organisation", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const email = uniqueEmail("invite");
  await open(page, await invite(request, owner, email));

  await expect(page.getByText(owner.organizationName, { exact: false })).toBeVisible();
  await expect(page.getByText(email, { exact: false })).toBeVisible();
  await page.locator("#fullName").fill("Fatoumata Bah");
  await page.locator("#pwd").fill(PASSWORD);
  await page.locator("#confirm").fill(PASSWORD);
  await page.getByRole("button", { name: "Définir mon mot de passe" }).click();

  await expect(page).toHaveURL(APP_URL);
  await expect(page.locator("#main-content")).toBeVisible();
});

test("un compte existant confirme son mot de passe pour rejoindre", async ({
  page,
  browser,
  request,
}) => {
  const owner = await createOwner(request);
  const email = uniqueEmail("existant");
  await signUp(page, email);
  const link = await invite(request, owner, email);

  const context = await browser.newContext();
  const fresh = await context.newPage();
  await open(fresh, link);
  await expect(fresh.locator("#confirm")).toHaveCount(0);

  await fresh.locator("#pwd").fill("Mauvais-Passe-2026");
  await fresh.getByRole("button", { name: "Rejoindre l'organisation" }).click();
  await expect(fresh.getByText("Identifiants invalides.")).toBeVisible();

  await fresh.locator("#pwd").fill(PASSWORD);
  await fresh.getByRole("button", { name: "Rejoindre l'organisation" }).click();
  await expect(fresh).toHaveURL(APP_URL);
  await context.close();
});

test("un lien d'invitation invalide est refusé", async ({ page }) => {
  await open(page, "/invitation?token=lien-invitation-invalide");
  await expect(page.getByText("Ce lien d'invitation est invalide", { exact: false })).toBeVisible();
});
