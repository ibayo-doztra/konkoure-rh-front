import { expect, test } from "@playwright/test";
import { APP_URL, createOwner, grantPlan, open, signIn } from "./support/app";

test("le propriétaire voit son essai, l'utilisation du mois et les offres", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/billing");

  await expect(page.getByTestId("subscription-status")).toHaveText("Période d'essai");
  await expect(page.getByText(/Utilisation du mois/)).toBeVisible();
  await expect(page.getByText("Crédits IA", { exact: true })).toBeVisible();
  await expect(page.getByTestId("plan-card").filter({ hasText: "Pro" })).toBeVisible();
  await expect(page.getByText("Aucun paiement pour le moment.")).toBeVisible();
  await expect(page.getByText("Aucune facture pour le moment.")).toBeVisible();
});

test("le propriétaire résilie puis réactive un abonnement payant", async ({ page, request }) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/billing");
  await expect(page.getByTestId("subscription-status")).toHaveText("Actif");

  await page.getByRole("button", { name: "Annuler l'abonnement" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler l'abonnement" }).click();
  await expect(
    page.getByText("Abonnement annulé — accès maintenu jusqu'à l'échéance."),
  ).toBeVisible();
  await expect(page.getByTestId("subscription-status")).toContainText("accès jusqu'au");

  await page.getByRole("button", { name: "Réactiver l'abonnement" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Réactiver l'abonnement" }).click();
  await expect(page.getByText("Abonnement réactivé")).toBeVisible();
  await expect(page.getByTestId("subscription-status")).toHaveText("Actif");
});

test("le paiement Mobile Money vérifie le numéro et signale un prestataire indisponible", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/billing/checkout?plan=pro&cycle=mensuel");

  await page.getByRole("button", { name: /Orange Money/ }).click();
  const pay = page.getByRole("button", { name: /^Payer .* GNF$/ });
  await page.getByLabel("Numéro Mobile Money").fill("123");
  await expect(page.getByText(/Numéro invalide/)).toBeVisible();
  await expect(pay).toBeDisabled();

  // No Djomy credentials (and no network) in e2e: the API answers 503.
  await page.getByLabel("Numéro Mobile Money").fill("622 12 34 56");
  await pay.click();
  await expect(
    page.getByText(
      "Le paiement en ligne est momentanément indisponible. Réessayez dans quelques minutes.",
    ),
  ).toBeVisible();
});

test("passer à une offre inférieure est programmé à l'échéance, sans paiement", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/billing/checkout?plan=starter&cycle=mensuel");

  await page.getByRole("button", { name: "Programmer le changement d'offre" }).click();
  await expect(page.getByRole("heading", { name: "Changement d'offre programmé" })).toBeVisible();
  await page.getByRole("link", { name: "Retour à l'abonnement" }).click();
  await expect(page.getByText(/Passage à l'offre Starter le/)).toBeVisible();
});
