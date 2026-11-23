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

/** Smallest file the API recognizes as a PDF (it checks the real signature). */
const PDF = {
  name: "cv.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(
    ["%PDF-1.4", "1 0 obj<<>>endobj", "trailer<<>>", "%%EOF", ""].join(String.fromCharCode(10)),
  ),
};

async function publishedJob(request: APIRequestContext, owner: Owner, title: string) {
  const headers = {
    Authorization: `Bearer ${owner.accessToken}`,
    "X-Organization-Id": owner.organizationId,
  };
  const created = await request.post(`${API_URL}/api/v1/org/recruitment/jobs`, {
    headers,
    data: { title, contractType: "cdd", description: "Saisie des factures." },
  });
  const job = ((await created.json()) as { data: { id: string; slug: string } }).data;
  const published = await request.post(`${API_URL}/api/v1/org/recruitment/jobs/${job.id}/publish`, {
    headers,
  });
  expect(published.ok()).toBeTruthy();
  return { ...job, headers };
}

// The API stores files on S3 only (file_storage.ts), which the e2e environment lacks:
// enabled once a local disk can be used outside production (asked to the backend).
test.fixme("un candidat postule sans compte, une seule fois par offre", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  const slug = await orgSlug(request, owner);
  const job = await publishedJob(request, owner, "Agent de saisie");
  const apply = async () => {
    await open(page, `/careers/${slug}/${job.slug}`);
    await page.getByLabel("Nom complet").fill("Fatoumata Camara");
    await page.getByLabel("Email").fill("fatoumata.camara@example.com");
    await page.getByLabel("Téléphone").fill("622123456");
    await page.locator("#apply-doc-cv").setInputFiles(PDF);
    await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
  };
  await apply();
  await expect(page.getByRole("heading", { name: "Candidature envoyée" })).toBeVisible();
  // Same e-mail again: refused by /apply/check before any file is sent.
  await page.evaluate(() => window.localStorage.clear());
  await apply();
  await expect(page.getByText("Vous avez déjà postulé à cette offre.").first()).toBeVisible();
});

test("les RH font avancer un candidat dans le pipeline jusqu'à l'embauche", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  const job = await publishedJob(request, owner, "Agent de saisie");
  // A candidate added by HR, without files (pieces are optional for the staff).
  const form = new FormData();
  form.append("jobId", job.id);
  form.append("fullName", "Fatoumata Camara");
  form.append("email", "fatoumata.camara@example.com");
  form.append("phone", "622 12 34 56");
  form.append("source", "referral");
  const added = await request.post(`${API_URL}/api/v1/org/recruitment/candidates`, {
    headers: job.headers,
    multipart: Object.fromEntries(form.entries()) as Record<string, string>,
  });
  expect(added.ok(), `candidate → ${added.status()}`).toBeTruthy();

  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/recruitment/candidates");
  const card = page.getByTestId("candidate-card").filter({ hasText: "Fatoumata Camara" });
  await expect(
    page.getByRole("region", { name: "Nouveau" }).getByText("Fatoumata Camara"),
  ).toBeVisible();
  await card.getByRole("button", { name: "Déplacer" }).click();
  await page.getByRole("menuitem", { name: "Entretien" }).click();
  await expect(
    page.getByRole("region", { name: "Entretien" }).getByText("Fatoumata Camara"),
  ).toBeVisible();

  await card.click();
  const detail = page.getByRole("dialog");
  await detail.getByLabel("Ajouter une note pour l'équipe…").fill("Très bon entretien.");
  await detail.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(detail.getByTestId("candidate-note").getByText("Très bon entretien.")).toBeVisible();
  await expect(detail.getByText(/Nouveau → Entretien|Entretien/).first()).toBeVisible();

  await detail.getByRole("button", { name: "Embaucher" }).click();
  await page.getByRole("dialog").last().getByRole("button", { name: "Embaucher" }).click();
  await expect(page.getByText("Candidat embauché, fiche employé créée")).toBeVisible();
  // The candidate is hired and linked to the new employee record.
  await expect(page.getByRole("dialog", { name: /Fatoumata Camara Embauché/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir la fiche employé" })).toBeVisible();
});
