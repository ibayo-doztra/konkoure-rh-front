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
