import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, createOwner, grantPlan, open, signIn, type Owner } from "./support/app";
import { API_URL } from "./support/settings";

// The e2e API runs with fake LinkedIn and Facebook credentials (its .env.test): the
// OAuth flow starts, but no page can be connected for real, so the publishing form
// itself is not reachable here.

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

test("les RH voient les réseaux à connecter et partent vers LinkedIn pour autoriser Konkouré", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await signInAt(page, owner.email, "/app/settings/integrations");

  const linkedin = page.getByTestId("social-provider-linkedin");
  await expect(linkedin).toContainText("Aucune page LinkedIn connectée.");
  await expect(page.getByTestId("social-provider-facebook")).toContainText(
    "Aucune page Facebook connectée.",
  );

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
