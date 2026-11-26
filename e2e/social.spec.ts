import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  APP_URL,
  createOwner,
  grantPlan,
  invite,
  open,
  signIn,
  uniqueEmail,
  type Owner,
} from "./support/app";
import { API_URL, PASSWORD } from "./support/settings";

// The e2e API runs with fake LinkedIn credentials (its .env.test) and without
// Facebook ones (e2e/support/settings.ts): LinkedIn starts the OAuth flow, Facebook
// answers 503. No page can be connected for real.

async function signInAt(page: Page, email: string, url: string) {
  await signIn(page, email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, url);
}

async function publishedJob(request: APIRequestContext, owner: Owner, title: string) {
  const headers = {
    Authorization: `Bearer ${owner.accessToken}`,
    "X-Organization-Id": owner.organizationId,
  };
  const created = await request.post(`${API_URL}/api/v1/org/recruitment/jobs`, {
    headers,
    data: { title, contractType: "cdi", description: "Gestion de la paie." },
  });
  const job = ((await created.json()) as { data: { id: string } }).data;
  const published = await request.post(`${API_URL}/api/v1/org/recruitment/jobs/${job.id}/publish`, {
    headers,
  });
  expect(published.ok()).toBeTruthy();
  return job;
}

test("un réseau non configuré est signalé, LinkedIn envoie vers son écran d'autorisation", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await signInAt(page, owner.email, "/app/settings/integrations");

  const linkedin = page.getByTestId("social-provider-linkedin");
  const facebook = page.getByTestId("social-provider-facebook");
  await expect(linkedin).toContainText("Aucune page LinkedIn connectée.");
  await expect(facebook).toContainText("Aucune page Facebook connectée.");

  // No Facebook credentials on the API: 503, the member stays on the page.
  await facebook.getByRole("button", { name: "Connecter" }).click();
  await expect(
    page.getByText("La connexion à Facebook n'est pas encore activée sur Konkouré."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings\/integrations$/);

  // The consent screen is LinkedIn's own: stop there instead of leaving the test network.
  await page.route("https://www.linkedin.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>LinkedIn</p>" }),
  );
  await linkedin.getByRole("button", { name: "Connecter" }).click();
  await expect(page).toHaveURL(/^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization\?/);
  const consent = new URL(page.url());
  expect(consent.searchParams.get("redirect_uri")).toBe(
    `${API_URL}/api/v1/oauth/social/linkedin/callback`,
  );
  expect(consent.searchParams.get("state")).toBeTruthy();
});

test("le retour de LinkedIn ou Facebook est annoncé puis retiré de l'adresse", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await signInAt(page, owner.email, "/app/settings/integrations?error=no_pages");
  await expect(page.getByText("Aucune page administrée n'a été trouvée")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings\/integrations$/);

  await open(page, "/app/settings/integrations?connected=facebook&count=2");
  await expect(page.getByText("2 pages Facebook connectées")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings\/integrations$/);
});

test("une offre publiée se partage depuis la liste, qui renvoie aux intégrations sans page", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await publishedJob(request, owner, "Responsable paie");
  await signInAt(page, owner.email, "/app/recruitment/jobs");

  const card = page.getByTestId("job-card").filter({ hasText: "Responsable paie" });
  await card.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Publier sur les réseaux" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Aucune page connectée")).toBeVisible();
  await expect(dialog.getByText("Aucune publication pour cette offre.")).toBeVisible();
  await dialog.getByRole("link", { name: "Aller aux intégrations" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/integrations$/);
});

test("le formulaire de publication refuse une page qui n'est plus active", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await publishedJob(request, owner, "Comptable");
  // Only the list is faked in the browser: the post itself reaches the real API,
  // which refuses an account it does not know (422 on accountIds).
  await page.route("**/api/v1/org/integrations/social/accounts", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "0192f1d2-0000-7000-8000-000000000001",
            provider: "linkedin",
            accountName: "Doztra SARL",
            status: "active",
          },
        ],
      },
    }),
  );
  await signInAt(page, owner.email, "/app/recruitment/jobs");

  const card = page.getByTestId("job-card").filter({ hasText: "Comptable" });
  await card.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Publier sur les réseaux" }).click();

  const dialog = page.getByRole("dialog");
  const publish = dialog.getByRole("button", { name: /^Publier/ });
  await expect(publish).toBeDisabled();
  await dialog.getByLabel("Doztra SARL").check();
  await dialog.getByRole("button", { name: "Publier sur 1 page" }).click();
  await expect(page.getByText("Le texte LinkedIn est vide")).toBeVisible();

  await dialog
    .getByRole("textbox", { name: "Texte LinkedIn" })
    .fill("Nous recrutons un comptable à Conakry.");
  await expect(dialog.getByText("38/3000")).toBeVisible();
  await dialog.getByRole("button", { name: "Publier sur 1 page" }).click();
  await expect(page.getByText("Une page choisie n'est plus active.")).toBeVisible();
  await expect(dialog.getByText("Aucune publication pour cette offre.")).toBeVisible();
});

test("un recruteur partage une offre mais ne connecte aucune page", async ({ page, request }) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await publishedJob(request, owner, "Chargé de recrutement");

  const email = uniqueEmail("recruiter");
  const token = new URL(await invite(request, owner, email, "recruiter"), API_URL).searchParams.get(
    "token",
  );
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Aïssatou Camara" },
  });
  expect(accepted.ok()).toBeTruthy();
  const { accessToken } = ((await accepted.json()) as { data: { accessToken: string } }).data;

  // The API lets a recruiter read the pages (reduced view) but not connect one.
  const connect = await request.post(`${API_URL}/api/v1/org/integrations/social/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}`, "X-Organization-Id": owner.organizationId },
    data: { provider: "linkedin" },
  });
  expect(connect.status()).toBe(403);

  const accounts = page.waitForResponse("**/api/v1/org/integrations/social/accounts");
  await signInAt(page, email, "/app/recruitment/jobs");
  await expect(page.getByRole("link", { name: "Réseaux sociaux" })).toHaveCount(0);

  const card = page.getByTestId("job-card").filter({ hasText: "Chargé de recrutement" });
  await card.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Publier sur les réseaux" }).click();
  expect((await accounts).status()).toBe(200);

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(
      "Demandez à un propriétaire ou aux RH de connecter une page LinkedIn ou Facebook.",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Aller aux intégrations" })).toHaveCount(0);
  await expect(dialog.getByText("Aucune publication pour cette offre.")).toBeVisible();
});
