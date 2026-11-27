import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, createOwner, invite, open, signIn, uniqueEmail } from "./support/app";
import { API_URL, PASSWORD } from "./support/settings";

// GET /me/export and DELETE /me (06 §2). No queue worker runs here: the export e-mail
// itself is not checked, only what the screen and the API answer.

async function signInAt(page: Page, email: string, url: string) {
  await signIn(page, email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, url);
}

async function deleteDialog(page: Page) {
  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  return page.getByRole("dialog");
}

async function createMember(request: APIRequestContext) {
  const owner = await createOwner(request);
  const email = uniqueEmail("member");
  const token = new URL(await invite(request, owner, email), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Ibrahima Sow" },
  });
  expect(accepted.ok()).toBeTruthy();
  return email;
}

test("l'export des données est lancé une fois par heure", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/account");

  const exportButton = page.getByRole("button", { name: "Exporter mes données" });
  await exportButton.click();
  await expect(page.getByText("Export lancé : vous recevrez un e-mail")).toBeVisible();

  await exportButton.click();
  await expect(
    page.getByText("Un export a déjà été demandé il y a moins d'une heure"),
  ).toBeVisible();
});

test("le seul propriétaire d'une organisation ne peut pas supprimer son compte", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/account");

  const dialog = await deleteDialog(page);
  await dialog.getByLabel("Mot de passe").fill("Mauvais-Passe-2026");
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(dialog.getByText("Mot de passe incorrect.")).toBeVisible();

  await dialog.getByLabel("Mot de passe").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(
    dialog.getByText("Vous êtes le seul propriétaire de ces organisations"),
  ).toBeVisible();
  await expect(dialog.getByRole("listitem")).toHaveText(owner.organizationName);
  await expect(dialog.getByText("Mot de passe incorrect.")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(page).toHaveURL(/\/app\/account$/);
});

test("un membre supprime son compte et ne peut plus se connecter", async ({ page, request }) => {
  const email = await createMember(request);
  await signInAt(page, email, "/app/account");

  const dialog = await deleteDialog(page);
  await dialog.getByLabel("Mot de passe").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Votre compte a été supprimé.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  const login = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(401);
});

test("déconnecter tous les appareils ferme aussi les autres sessions", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  // A second device, signed in outside the browser.
  const other = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: owner.email, password: PASSWORD },
  });
  expect(other.ok()).toBeTruthy();
  const { refreshToken } = ((await other.json()) as { data: { refreshToken: string } }).data;

  await signInAt(page, owner.email, "/app/account");
  await page.getByRole("button", { name: "Déconnecter tous les appareils" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Déconnecter tous les appareils" })
    .click();
  await expect(page.getByText("Tous vos appareils ont été déconnectés")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  const refreshed = await request.post(`${API_URL}/api/v1/auth/refresh`, {
    data: { refreshToken },
  });
  expect(refreshed.status()).toBe(401);

  // The browser session is gone too: the app sends back to the login page.
  await page.goto("/app/account");
  await expect(page).toHaveURL(/\/login/);
});
