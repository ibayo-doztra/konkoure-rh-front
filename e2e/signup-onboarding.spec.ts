import { expect, test } from "@playwright/test";
import { APP_URL, fillSignup, mailLink, open, signUp, uniqueEmail } from "./support/app";
import { PASSWORD } from "./support/settings";

const verifiedCheck = "J'ai confirmé mon e-mail";

test("un nouveau compte vérifie son e-mail puis crée son organisation", async ({ page }) => {
  const email = uniqueEmail("parcours");
  await signUp(page, email);
  await expect(page.getByText(email)).toBeVisible();

  await open(page, await mailLink(email, "/verify-email"));
  await expect(page.getByText("Votre adresse e-mail est confirmée.")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/onboarding\/organization$/);
  await page.locator("#name").fill("Bauxite de Boké");
  await page.getByRole("button", { name: "Créer l'organisation" }).click();

  await expect(page).toHaveURL(APP_URL);
  await expect(page.locator("#main-content")).toBeVisible();

  // The access token lives in memory: the session must survive through the cookie.
  await page.reload();
  await expect(page).toHaveURL(APP_URL);
  await expect(page.locator("#main-content")).toBeVisible();
});

test("l'organisation reste bloquée tant que l'e-mail n'est pas confirmé", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("blocage");
  await signUp(page, email);
  await expect(page.locator("#name")).toHaveCount(0);

  await page.getByRole("button", { name: verifiedCheck }).click();
  await expect(page.getByText("Votre adresse e-mail n'est pas encore confirmée.")).toBeVisible();
  await expect(page.locator("#name")).toHaveCount(0);

  const mailTab = await context.newPage();
  await open(mailTab, await mailLink(email, "/verify-email"));
  await expect(mailTab.getByText("Votre adresse e-mail est confirmée.")).toBeVisible();
  await mailTab.close();

  await page.getByRole("button", { name: verifiedCheck }).click();
  await expect(page.locator("#name")).toBeVisible();
});

test("l'e-mail de vérification peut être renvoyé et le nouveau lien fonctionne", async ({
  page,
}) => {
  const email = uniqueEmail("renvoi");
  await signUp(page, email);
  await mailLink(email, "/verify-email");

  await page.getByRole("button", { name: "Renvoyer l'e-mail de vérification" }).click();
  await expect(page.getByText("E-mail de vérification envoyé.", { exact: false })).toBeVisible();

  await open(page, await mailLink(email, "/verify-email", 2));
  await expect(page.getByText("Votre adresse e-mail est confirmée.")).toBeVisible();
});

test("un autre compte peut être utilisé depuis l'écran de vérification", async ({ page }) => {
  await signUp(page, uniqueEmail("autre"));
  await page.getByRole("button", { name: "Utiliser un autre compte" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("un lien de vérification invalide est refusé", async ({ page }) => {
  await open(page, "/verify-email?token=lien-de-verification-invalide");
  await expect(page.getByText("Ce lien de vérification est invalide ou a expiré.")).toBeVisible();
  await page.getByRole("button", { name: "Retour à la connexion" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("un lien de vérification sans jeton est refusé", async ({ page }) => {
  await open(page, "/verify-email");
  await expect(page.getByText("Ce lien de vérification est invalide ou a expiré.")).toBeVisible();
});

test("l'inscription applique la politique de mot de passe", async ({ page }) => {
  await open(page, "/signup");
  const submit = page.getByRole("button", { name: "Créer mon compte" });
  await expect(page.getByText("Au moins 10 caractères", { exact: false })).toBeVisible();

  await fillSignup(page, uniqueEmail("politique"), "Court1");
  await expect(submit).toBeDisabled();

  await page.locator("#password").fill("sansmajuscule1");
  await page.locator("#confirm").fill("sansmajuscule1");
  await expect(submit).toBeDisabled();

  await page.locator("#password").fill(PASSWORD);
  await page.locator("#confirm").fill(`${PASSWORD}x`);
  await expect(page.getByText("Les mots de passe ne correspondent pas.")).toBeVisible();
  await expect(submit).toBeDisabled();

  await page.locator("#confirm").fill(PASSWORD);
  await expect(submit).toBeEnabled();
});

test("un mot de passe trop courant est refusé par l'API", async ({ page }) => {
  await open(page, "/signup");
  await fillSignup(page, uniqueEmail("courant"), "Charlie123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Ce mot de passe est trop courant.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});

test("un mot de passe contenant l'adresse e-mail est refusé par l'API", async ({ page }) => {
  const email = uniqueEmail("perso");
  await open(page, "/signup");
  await fillSignup(page, email, `Aa1${email.split("@")[0]}`);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(
    page.getByText("Le mot de passe ne doit contenir ni votre nom ni votre adresse e-mail."),
  ).toBeVisible();
});

test("une adresse déjà enregistrée est signalée", async ({ page, browser }) => {
  const email = uniqueEmail("doublon");
  await signUp(page, email);

  const context = await browser.newContext();
  const other = await context.newPage();
  await open(other, "/signup");
  await fillSignup(other, email);
  await other.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(other.getByText("Cette adresse e-mail est déjà enregistrée.")).toBeVisible();
  await context.close();
});
