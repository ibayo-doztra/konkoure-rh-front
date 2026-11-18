import { expect, test } from "@playwright/test";
import { APP_URL, createOwner, mailLink, open, signIn, signUp, uniqueEmail } from "./support/app";
import { PASSWORD } from "./support/settings";

const NEW_PASSWORD = "Fromager-Vert-2027";

test("la connexion refuse de mauvais identifiants", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email, "Mauvais-Passe-2026");
  await expect(page.getByText("Identifiants invalides.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("un compte avec organisation arrive dans l'application", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await expect(page.locator("#main-content")).toBeVisible();
});

test("un compte non vérifié arrive sur l'écran de vérification", async ({ page, browser }) => {
  const email = uniqueEmail("connexion");
  await signUp(page, email);

  const context = await browser.newContext();
  const fresh = await context.newPage();
  await signIn(fresh, email);
  await expect(fresh).toHaveURL(/\/onboarding\/organization$/);
  await expect(fresh.getByRole("button", { name: "J'ai confirmé mon e-mail" })).toBeVisible();
  await context.close();
});

test("le paramètre next ne permet pas de quitter le site", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email, PASSWORD, "/login?next=//evil.example/piege");
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/app(\?.*)?$/);
});

test("le mot de passe oublié se réinitialise avec un lien à usage unique", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);

  await open(page, "/reset-password");
  await page.locator("#email").fill(owner.email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByText("E-mail envoyé. Vérifiez votre boîte.")).toBeVisible();

  const link = await mailLink(owner.email, "/reset-password");
  await open(page, link);
  await page.locator("#newp").fill(NEW_PASSWORD);
  await page.locator("#confp").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Mettre à jour" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, owner.email);
  await expect(page.getByText("Identifiants invalides.")).toBeVisible();
  await signIn(page, owner.email, NEW_PASSWORD);
  await expect(page).toHaveURL(APP_URL);

  await page.context().clearCookies();
  await open(page, link);
  await page.locator("#newp").fill(PASSWORD);
  await page.locator("#confp").fill(PASSWORD);
  await page.getByRole("button", { name: "Mettre à jour" }).click();
  await expect(page.getByText("Lien invalide ou expiré.")).toBeVisible();
});
