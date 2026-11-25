import { expect, test, type Page } from "@playwright/test";
import { API_URL } from "./support/settings";
import { createOwner, fillSignup, mailLink, open, signIn, uniqueEmail } from "./support/app";

// Djomy is not configured in e2e: the real checkout answers 503 and no payment
// can reach `succeeded`. The paid path is therefore simulated on
// `/public/payments/**`; the real claim is covered by the API's Japa tests.
const REF = "7f1c2a9e-4b3d-4e5f-8a6b-1c2d3e4f5a6b";
const TOKEN = "clm_e2eTokenAbcdefghijklmnop";
const PAYMENTS = `${API_URL}/api/v1/public/payments`;

type Status = { status: string; claimable: boolean; emailMasked?: string };

/** Answers `GET /public/payments/:ref` with the statuses given, the last one repeated. */
async function mockStatus(page: Page, statuses: Status[]) {
  let calls = 0;
  await page.route(`${PAYMENTS}/${REF}`, async (route) => {
    expect(route.request().headers()["x-claim-token"]).toBe(TOKEN);
    const current = statuses[Math.min(calls, statuses.length - 1)];
    calls += 1;
    await route.fulfill({
      json: {
        data: {
          planCode: "pro",
          cycle: "monthly",
          expectedAmount: 450000,
          currency: "GNF",
          emailMasked: "a***@example.com",
          ...current,
        },
      },
    });
  });
}

/** The claim creates a real organization through `POST /organizations`, with the page's session. */
async function mockClaim(page: Page) {
  await page.route(`${PAYMENTS}/${REF}/claim`, async (route) => {
    const body = route.request().postDataJSON() as { claimToken: string; organizationName: string };
    expect(body.claimToken).toBe(TOKEN);
    const response = await route.fetch({
      url: `${API_URL}/api/v1/organizations`,
      postData: JSON.stringify({ name: body.organizationName }),
    });
    await route.fulfill({ response, status: 201 });
  });
}

test("la page de paiement liste les offres payantes et signale un prestataire indisponible", async ({
  page,
}) => {
  await open(page, "/paiement?plan=pro");
  await expect(page.getByRole("button", { name: /^Starter/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pro/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Entreprise/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Gratuit/ })).toHaveCount(0);

  await page.locator("#email").fill(uniqueEmail("prepaye"));
  await page.getByRole("button", { name: /Orange Money/ }).click();
  await page.locator("#payer").fill("624 00 00 00");
  await page.getByRole("button", { name: /^Payer .* GNF$/ }).click();

  await expect(
    page.getByText("Le paiement en ligne est momentanément indisponible.", { exact: false }),
  ).toBeVisible();
});

test("un code de suivi inconnu ne révèle aucun paiement", async ({ page }) => {
  await open(page, `/paiement/suivi?ref=${REF}&claim=${TOKEN}`);
  await expect(
    page.getByText("Aucun paiement ne correspond à cette référence et à ce code."),
  ).toBeVisible();
});

test("le suivi manuel exige la référence et le code", async ({ page }) => {
  await mockStatus(page, [{ status: "pending", claimable: false }]);
  await open(page, "/paiement/suivi");
  const show = page.getByRole("button", { name: "Afficher l'état du paiement" });
  await page.locator("#payment-ref").fill("pas-une-reference");
  await page.locator("#claim").fill(TOKEN);
  await expect(show).toBeDisabled();

  await page.locator("#payment-ref").fill(REF);
  await show.click();
  await expect(page.getByTestId("payment-tracker")).toContainText("En attente");
});

test("payer avant l'inscription, créer son compte puis l'organisation de l'abonnement", async ({
  page,
}) => {
  const email = uniqueEmail("prepaye");
  await page.route(`${PAYMENTS}/checkout`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, string>;
    expect(body).toMatchObject({
      cycle: "monthly",
      method: "orange_money",
      payerPhone: "+224624000000",
      email,
    });
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      status: 201,
      json: {
        data: {
          merchantReference: REF,
          claimToken: TOKEN,
          claimExpiresAt: null,
          status: "pending",
          expectedAmount: 450000,
          currency: "GNF",
          instructions: "Validez la demande sur votre téléphone.",
          redirectUrl: null,
        },
      },
    });
  });
  await mockStatus(page, [
    { status: "pending", claimable: false },
    { status: "succeeded", claimable: true },
  ]);
  await mockClaim(page);

  await open(page, "/paiement?plan=pro");
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: /Orange Money/ }).click();
  await page.locator("#payer").fill("624 00 00 00");
  await page.getByRole("button", { name: /^Payer .* GNF$/ }).click();

  await expect(page.getByText("Validez la demande sur votre téléphone.")).toBeVisible();
  const tracker = page.getByTestId("payment-tracker");
  await expect(tracker).toContainText("Paiement confirmé");
  await tracker.getByRole("link", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/signup\?/);
  await fillSignup(page, email);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("button", { name: "J'ai confirmé mon e-mail" })).toBeVisible();

  await open(page, await mailLink(email, "/verify-email"));
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/onboarding\/organization$/);
  await expect(page.getByText("Créez l'organisation de votre abonnement")).toBeVisible();
  await page.locator("#name").fill("Mines de Siguiri");
  await page.getByRole("button", { name: "Créer l'organisation et activer l'abonnement" }).click();

  await expect(page).toHaveURL(/\/app\/billing$/);
  await expect(page.getByText("Un abonnement payé attend son organisation")).toHaveCount(0);
});

test("un compte existant se voit proposer l'organisation de son paiement après connexion", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await mockStatus(page, [{ status: "succeeded", claimable: true }]);

  // The tracking link keeps the claim in this browser.
  await open(page, `/paiement/suivi?ref=${REF}&claim=${TOKEN}`);
  await expect(page.getByTestId("payment-tracker")).toContainText("Paiement confirmé");

  await signIn(page, owner.email);
  await expect(page).toHaveURL(/\/onboarding\/organization$/);
  await expect(
    page.getByText("Vous avez payé un abonnement avant de vous connecter.", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Plus tard" }).click();
  await expect(page).toHaveURL(/\/app(\?.*)?$/);

  await open(page, "/app/billing");
  await expect(page.getByText("Un abonnement payé attend son organisation")).toBeVisible();
});

test("un paiement fait avec une autre adresse est refusé, un paiement déjà utilisé est oublié", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await mockStatus(page, [{ status: "succeeded", claimable: true }]);
  let rule = "email";
  await page.route(`${PAYMENTS}/${REF}/claim`, (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: {
          code: "E_CLAIM_INVALID",
          message: "Paiement inutilisable",
          details: [{ field: "claimToken", rule, message: "" }],
        },
      },
    }),
  );

  await open(page, `/paiement/suivi?ref=${REF}&claim=${TOKEN}`);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(/\/onboarding\/organization$/);
  await page.getByRole("radio", { name: "Créer une nouvelle organisation" }).click();
  const submit = page.getByRole("button", { name: "Créer l'organisation et activer l'abonnement" });
  await page.locator("#name").fill("Autre société");
  await submit.click();
  await expect(
    page.getByText("Ce paiement a été fait avec une autre adresse e-mail (a***@example.com).", {
      exact: false,
    }),
  ).toBeVisible();

  rule = "used";
  await submit.click();
  await expect(page.getByText("Ce paiement a déjà servi à créer une organisation.")).toBeVisible();
  // The code is forgotten: an account with an organization goes back to the app.
  await expect(page).toHaveURL(/\/app(\?.*)?$/);
  await open(page, "/app/billing");
  await expect(page.getByText("Un abonnement payé attend son organisation")).toHaveCount(0);
});

test("un propriétaire applique son paiement à son organisation existante", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await mockStatus(page, [{ status: "succeeded", claimable: true }]);
  await page.route(`${PAYMENTS}/${REF}/claim`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, string>;
    expect(body).toEqual({ claimToken: TOKEN, organizationId: owner.organizationId });
    await route.fulfill({
      status: 201,
      json: {
        data: {
          id: owner.organizationId,
          name: owner.organizationName,
          slug: "societe",
          logoUrl: null,
          defaultLanguage: "fr",
          defaultCurrency: "GNF",
          performanceModel: "sap",
          roles: ["owner"],
          plan: "pro",
        },
      },
    });
  });

  await open(page, `/paiement/suivi?ref=${REF}&claim=${TOKEN}`);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(/\/onboarding\/organization$/);
  await expect(page.getByText("Utilisez votre abonnement payé")).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "L'appliquer à une organisation existante" }),
  ).toBeChecked();
  await expect(page.locator("#organization")).toContainText(owner.organizationName);

  await page.getByRole("button", { name: "Appliquer l'abonnement" }).click();
  await expect(
    page.getByText("Votre abonnement payé est appliqué à cette organisation."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/billing$/);
  await expect(page.getByText("Un abonnement payé attend son organisation")).toHaveCount(0);
});
