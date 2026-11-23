import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, createOwner, grantPlan, open, signIn, type Owner } from "./support/app";
import { API_URL } from "./support/settings";

async function orgSlug(request: APIRequestContext, owner: Owner) {
  const response = await request.get(`${API_URL}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      "X-Organization-Id": owner.organizationId,
    },
  });
  const { data } = (await response.json()) as {
    data: { organizations: { id: string; slug: string }[] };
  };
  return data.organizations.find((o) => o.id === owner.organizationId)!.slug;
}

/** Fills the offer form; the description is a rich text editor. */
async function fillJob(page: Page, job: { title: string; description?: string }) {
  await page.getByLabel("Titre", { exact: true }).fill(job.title);
  if (job.description) await page.locator(".ProseMirror").first().fill(job.description);
  await page.getByLabel("Localisation", { exact: true }).fill("Conakry, Guinée");
}

test("les RH publient une offre, visible sur la page carrières, puis la clôturent", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  const slug = await orgSlug(request, owner);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);

  // Publishing needs a description (422): the draft is kept and opened for editing.
  await open(page, "/app/recruitment/jobs/new");
  await fillJob(page, { title: "Comptable confirmé" });
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/recruitment\/jobs\/[0-9a-f-]{36}\/edit$/);

  await page.locator(".ProseMirror").first().fill("Tenue de la comptabilité générale.");
  await page.getByRole("button", { name: "Diplôme" }).click();
  await page.getByRole("button", { name: "Enregistrer & publier" }).click();
  await expect(page.getByText("Offre publiée")).toBeVisible();
  const card = page.getByTestId("job-card").filter({ hasText: "Comptable confirmé" });
  await expect(card.getByText("Publiée")).toBeVisible();
  await expect(card.getByText("2 documents demandés")).toBeVisible();

  // The public pages, without a session.
  await page.context().clearCookies();
  await open(page, `/careers/${slug}`);
  await page.getByRole("link", { name: /Comptable confirmé/ }).click();
  await expect(page.getByRole("heading", { name: "Comptable confirmé" })).toBeVisible();
  await expect(page.getByText("Tenue de la comptabilité générale.")).toBeVisible();
  // The CV is always asked, on top of the pieces of the offer.
  await expect(page.locator("label", { hasText: /^CV/ })).toBeVisible();
  await expect(page.locator("label", { hasText: /^Diplôme/ })).toBeVisible();

  // Closed, the offer leaves the careers page.
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/recruitment/jobs");
  await card.getByRole("button", { name: "Clôturer" }).click();
  await expect(card.getByText("Clôturée")).toBeVisible();
  await page.context().clearCookies();
  await open(page, `/careers/${slug}`);
  await expect(page.getByText("Aucune offre", { exact: false })).toBeVisible();
  await open(page, `/careers/${slug}/unknown-offer`);
  await expect(page.getByText("introuvable", { exact: false })).toBeVisible();
});

test("une offre se duplique en brouillon puis se supprime", async ({ page, request }) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/recruitment/jobs/new");
  await fillJob(page, { title: "Chauffeur livreur", description: "Livraisons à Kaloum." });
  await page.getByRole("button", { name: "Enregistrer brouillon" }).click();
  await expect(page.getByText("Offre enregistrée")).toBeVisible();

  const cards = page.getByTestId("job-card").filter({ hasText: "Chauffeur livreur" });
  await cards.first().getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Dupliquer" }).click();
  await expect(page.getByText("Offre dupliquée en brouillon")).toBeVisible();
  await expect(cards).toHaveCount(2);

  await cards.first().getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Offre supprimée")).toBeVisible();
  await expect(cards).toHaveCount(1);
});
