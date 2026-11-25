import { expect, test, type Page } from "@playwright/test";
import { APP_URL, createOwner, grantPlatform, open, signIn } from "./support/app";

async function openBackOffice(page: Page, email: string, path = "/konkoureoffice") {
  await signIn(page, email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, path);
}

test("le back office est refusé à un compte qui n'est pas admin plateforme", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await openBackOffice(page, owner.email);
  await expect(page.getByText("Accès restreint")).toBeVisible();
});

test("un admin root consulte le tableau de bord, suspend puis réactive une organisation", async ({
  page,
  request,
}) => {
  const admin = await createOwner(request);
  grantPlatform(admin.email, "root");
  const client = await createOwner(request);

  await openBackOffice(page, admin.email);
  await expect(page.getByText("Organisations actives")).toBeVisible();
  await expect(page.getByTestId("subscriptions-by-status")).toContainText("Essai");

  await open(page, "/konkoureoffice/organisations");
  await page.getByLabel("Rechercher une organisation").fill(client.organizationName);
  const manage = page.getByRole("button", { name: `Gérer ${client.organizationName}` });
  await expect(manage).toHaveCount(1);
  await manage.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("organization-summary")).toContainText("Essai");
  await dialog.getByRole("button", { name: "Suspendre" }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "Suspendre" }).click();
  await expect(page.getByText("Organisation suspendue")).toBeVisible();
  await expect(dialog.getByTestId("organization-summary")).toContainText("Suspendu");

  await dialog.getByRole("button", { name: "Réactiver" }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "Réactiver" }).click();
  await expect(page.getByText("Organisation réactivée")).toBeVisible();
  await expect(dialog.getByTestId("organization-summary")).toContainText("Essai");
});

test("un admin root crée, modifie puis supprime une offre", async ({ page, request }) => {
  const admin = await createOwner(request);
  grantPlatform(admin.email, "root");
  const code = `e2e-${Date.now()}`;

  await openBackOffice(page, admin.email, "/konkoureoffice/offres");
  await page.getByRole("button", { name: "Nouvelle offre" }).click();
  await page.locator("#code").fill(code);
  await page.locator("#nom").fill("Offre e2e");
  await page.locator("#prix").fill("150000");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Offre enregistrée")).toBeVisible();

  const card = page.getByTestId("platform-plan").filter({ hasText: code });
  await expect(card).toContainText("Offre e2e");
  await card.getByRole("button", { name: "Modifier Offre e2e" }).click();
  await expect(page.locator("#code")).toBeDisabled();
  await page.locator("#nom").fill("Offre e2e modifiée");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(card).toContainText("Offre e2e modifiée");

  await card.getByRole("button", { name: "Supprimer Offre e2e modifiée" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Offre supprimée")).toBeVisible();
  await expect(card).toContainText("Supprimée");
});

test("un admin support consulte sans pouvoir modifier", async ({ page, request }) => {
  const admin = await createOwner(request);
  grantPlatform(admin.email, "support");
  const client = await createOwner(request);

  await openBackOffice(page, admin.email, "/konkoureoffice/offres");
  await expect(page.getByTestId("platform-plan").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Nouvelle offre" })).toHaveCount(0);

  await open(page, "/konkoureoffice/organisations");
  await page.getByLabel("Rechercher une organisation").fill(client.organizationName);
  await page.getByRole("button", { name: `Gérer ${client.organizationName}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Lecture seule", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Suspendre" })).toHaveCount(0);
});

test("un admin root bannit puis réactive un compte", async ({ page, request }) => {
  const admin = await createOwner(request);
  grantPlatform(admin.email, "root");
  const target = await createOwner(request);

  await openBackOffice(page, admin.email, "/konkoureoffice/utilisateurs");
  await page.getByLabel("Rechercher un utilisateur").fill(target.email);
  const state = page.getByTestId(`user-state-${target.email}`).filter({ visible: true });
  await expect(state).toContainText("Actif");

  await page.getByRole("button", { name: `Actions pour ${target.email}` }).click();
  await page.getByRole("menuitem", { name: "Bannir le compte" }).click();
  await page.locator("#reason").fill("Fraude constatée");
  await page.getByRole("dialog").getByRole("button", { name: "Bannir" }).click();
  await expect(page.getByText("Compte banni", { exact: false })).toBeVisible();
  await expect(state).toContainText("Banni");

  await page.getByRole("button", { name: `Actions pour ${target.email}` }).click();
  await page.getByRole("menuitem", { name: "Réactiver le compte" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Réactiver" }).click();
  await expect(state).toContainText("Actif");
});

test("un admin root agit en tant qu'un compte puis revient au back office", async ({
  page,
  request,
}) => {
  const admin = await createOwner(request);
  grantPlatform(admin.email, "root");
  const target = await createOwner(request);

  await openBackOffice(page, admin.email, "/konkoureoffice/utilisateurs");
  await page.getByLabel("Rechercher un utilisateur").fill(target.email);
  await page.getByRole("button", { name: `Actions pour ${target.email}` }).click();
  await page.getByRole("menuitem", { name: "Se connecter en tant que" }).click();
  await page.locator("#reason").fill("Assistance demandée par le client");
  await page.getByRole("dialog").getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(APP_URL);
  const banner = page.getByTestId("impersonation-banner");
  await expect(banner).toContainText(target.email);

  await banner.getByRole("button", { name: "Quitter" }).click();
  await expect(page).toHaveURL(/\/konkoureoffice\/utilisateurs$/);
  await expect(page.getByText("Session d'assistance terminée.")).toBeVisible();
  await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);
});

test("un admin root change les rôles d'un compte et nomme un admin support", async ({
  page,
  request,
}) => {
  const admin = await createOwner(request);
  grantPlatform(admin.email, "root");
  const target = await createOwner(request);

  await openBackOffice(page, admin.email, "/konkoureoffice/utilisateurs");
  await page.getByLabel("Rechercher un utilisateur").fill(target.email);
  await page.getByRole("button", { name: `Actions pour ${target.email}` }).click();
  await page.getByRole("menuitem", { name: "Modifier les rôles" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Manager" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Rôles mis à jour")).toBeVisible();
  await expect(
    page.getByText(`Manager · ${target.organizationName}`).filter({ visible: true }),
  ).toBeVisible();

  await page.locator("#admin-email").fill(target.email);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("platform-admins")).toContainText(target.email);
  await expect(
    page.getByTestId(`user-state-${target.email}`).filter({ visible: true }),
  ).toContainText("Support");
});
