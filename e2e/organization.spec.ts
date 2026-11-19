import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, createOwner, invite, open, signIn, uniqueEmail } from "./support/app";
import { API_URL, PASSWORD } from "./support/settings";

async function signInAt(page: Page, email: string, url: string, password = PASSWORD) {
  await signIn(page, email, password);
  await expect(page).toHaveURL(APP_URL);
  await open(page, url);
}

async function acceptInvitation(request: APIRequestContext, link: string) {
  const token = new URL(link, API_URL).searchParams.get("token");
  const response = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Fatoumata Bah" },
  });
  expect(response.ok()).toBeTruthy();
}

test("le propriétaire modifie son organisation et remplace le logo", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/settings");

  const name = page.locator("#org-name");
  await expect(name).toHaveValue(owner.organizationName);
  await name.fill(`${owner.organizationName} SA`);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres enregistrés")).toBeVisible();

  // Object storage is not available here: only the request sent by the screen is checked.
  let upload = "";
  await page.route("**/api/v1/org/logo", async (route) => {
    upload = route.request().postDataBuffer()?.toString("latin1") ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": new URL(page.url()).origin,
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({ data: { logoUrl: `${new URL(page.url()).origin}/logo.png` } }),
    });
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await expect(page.getByText("Logo mis à jour")).toBeVisible();
  expect(upload).toContain('name="logo"');

  await page.reload();
  await expect(page.locator("#org-name")).toHaveValue(`${owner.organizationName} SA`);
});

test("le propriétaire gère les invitations et les membres", async ({ page, request }) => {
  const owner = await createOwner(request);
  const memberEmail = uniqueEmail("membre");
  await acceptInvitation(request, await invite(request, owner, memberEmail));

  await signInAt(page, owner.email, "/app/settings/members");
  const main = page.locator("#main-content");
  await expect(main.getByText(owner.email)).toBeVisible();
  await expect(main.getByText(memberEmail)).toBeVisible();

  const invited = uniqueEmail("invite");
  await page.getByRole("button", { name: "Inviter un membre" }).click();
  await page.locator("#invite-email").fill(invited);
  await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText("Invitation envoyée")).toBeVisible();
  await expect(main.getByText(invited)).toBeVisible();

  await page.getByRole("button", { name: `Renvoyer l'invitation à ${invited}` }).click();
  await expect(page.getByText("Invitation renvoyée")).toBeVisible();

  await page.getByRole("button", { name: `Révoquer l'invitation de ${invited}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Révoquer" }).click();
  await expect(main.getByText(invited)).toHaveCount(0);

  await page.getByRole("button", { name: "Modifier les rôles de Fatoumata Bah" }).click();
  await page.getByRole("dialog").getByLabel("Recruteur").click();
  await page.getByRole("button", { name: "Enregistrer les rôles" }).click();
  await expect(page.getByText("Rôles mis à jour")).toBeVisible();
  await expect(main.getByText("Recruteur")).toBeVisible();

  await page.getByRole("button", { name: "Retirer Fatoumata Bah" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Retirer" }).click();
  await expect(main.getByText(memberEmail)).toHaveCount(0);
});

test("un utilisateur met à jour son profil et son mot de passe", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/account");

  await page.locator("#account-name").fill("Mamadou Barry");
  await page.getByRole("button", { name: "Enregistrer le profil" }).click();
  await expect(page.getByText("Profil mis à jour")).toBeVisible();
  await expect(page.getByText("Cette session")).toBeVisible();

  await page.locator("#current-password").fill("Mauvais-Passe-2026");
  await page.locator("#new-password").fill("Baobab-Ancien-2026");
  await page.locator("#confirm-password").fill("Baobab-Ancien-2026");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.locator("#current-password")).toHaveValue("Mauvais-Passe-2026");

  await page.locator("#current-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText("Mot de passe modifié")).toBeVisible();

  const login = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: owner.email, password: "Baobab-Ancien-2026" },
  });
  expect(login.ok()).toBeTruthy();
});

test("la suppression exige le nom exact de l'organisation", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/settings");

  await page.getByRole("button", { name: "Supprimer l'organisation" }).click();
  const dialog = page.getByRole("dialog");
  const confirmButton = dialog.getByRole("button", { name: "Supprimer définitivement" });
  await dialog.getByRole("textbox").fill("Autre nom");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByRole("textbox").fill(owner.organizationName);
  await confirmButton.click();

  await expect(page).toHaveURL(/\/onboarding\/organization$/);
});
